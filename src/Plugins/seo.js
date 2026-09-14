import apiFetch from '@wordpress/api-fetch';
import { getBlockType } from '@wordpress/blocks';
import {
    Button,
    Notice,
    PanelBody,
    PanelRow,
    Spinner,
    TextareaControl,
    TextControl,
    VisuallyHidden,
} from '@wordpress/components';
import { useDebounce } from '@wordpress/compose';
import { store as coreStore } from '@wordpress/core-data';
import { select, useDispatch, useSelect } from '@wordpress/data';
// PluginSidebar and PluginSidebarMoreMenuItem live in @wordpress/editor since WordPress 6.6 and
// work in both the post editor and the Site Editor.
import { PluginSidebar, PluginSidebarMoreMenuItem, store as editorStore } from '@wordpress/editor';
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';

// Helpers live in a subdirectory so webpack.config.js does not turn them into entries.
import { STATUS, runSeoChecks } from './seo/checks';
import { analyzeBlocks } from './seo/content';
import { countCharacters, isSameKeyphrase, safeDecode, uniqueKeyphrases } from './seo/text';

const SIDEBAR_NAME = 'odiseia-seo-tool';
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;
const WARNING_COLOR = '#cc1818';
const HINT_COLOR = '#757575';
const SETTINGS = window.odiseiaSeoSettings || {};
const TITLE_SEPARATOR = typeof SETTINGS.titleSeparator === 'string' ? SETTINGS.titleSeparator : ' – ';
// Same list the server uses for meta registration and front-end output (Seo::get_post_types()).
const POST_TYPES = Array.isArray(SETTINGS.postTypes) ? SETTINGS.postTypes : [];

const truncate = (value, limit) => {
    const characters = Array.from(value || '');
    if (characters.length <= limit) {
        return characters.join('');
    }
    return `${characters.slice(0, limit).join('').trimEnd()}…`;
};

/**
 * Decodes HTML entities in stored text (e.g. `blogname` is saved escaped) for display.
 * React escapes the result when rendering, so no markup is injected.
 */
const decode = (value) => (typeof value === 'string' && value ? decodeEntities(value) : '');

/**
 * Converts HTML (including serialized block markup) to collapsed plain text.
 */
const stripHtml = (html) => {
    if (!html) {
        return '';
    }
    const doc = new window.DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

/**
 * Builds a Google-like breadcrumb: "example.com › parent › slug".
 */
const buildBreadcrumb = (url) => {
    if (!url) {
        return '';
    }
    try {
        const parsed = new window.URL(url);
        const segments = parsed.pathname.split('/').filter(Boolean).map(safeDecode);
        return [parsed.host, ...segments].join(' › ');
    } catch (error) {
        return url;
    }
};

/**
 * Selects the values WordPress uses to compose the default document title.
 *
 * Mirrors wp_get_document_title(): the page set as static front page renders
 * "Site name{sep}Tagline"; any other singular view, and the page set as Posts page
 * (single_post_title() of the queried page), renders "Post title{sep}Site name".
 */
const selectTitleContext = (sel) => {
    const editor = sel(editorStore);
    // Same record the editor preloads: includes name, description, home, url, site_icon_url,
    // show_on_front, and page_on_front.
    const site = sel(coreStore).getEntityRecord('root', '__unstableBase');
    const isFrontPage =
        !!site &&
        site.show_on_front === 'page' &&
        editor.getCurrentPostType() === 'page' &&
        Number(site.page_on_front) > 0 &&
        Number(site.page_on_front) === Number(editor.getCurrentPostId());

    return {
        site,
        postTitle: decode(editor.getEditedPostAttribute('title')),
        siteName: decode(site?.name),
        tagline: decode(site?.description),
        isFrontPage,
    };
};

const composeDefaultTitle = ({ postTitle, siteName, tagline, isFrontPage }) => {
    const parts = isFrontPage ? [siteName, tagline] : [postTitle, siteName];
    return parts.filter(Boolean).join(TITLE_SEPARATOR);
};

const useSeoMeta = () => {
    const meta = useSelect((sel) => sel(editorStore).getEditedPostAttribute('meta') || {}, []);
    const { editPost } = useDispatch(editorStore);

    // Post meta edits are merged by core-data, so only the changed key is sent.
    const setMeta = useCallback((key, value) => editPost({ meta: { [key]: value } }), [editPost]);

    return {
        metaTitle: meta._meta_title || '',
        metaDescription: meta._meta_description || '',
        focusKeyword: meta._meta_focus_keyword || '',
        setMeta,
    };
};

const CharacterCounter = ({ value, limit }) => {
    const count = countCharacters(value);
    const exceeded = count > limit;

    return (
        <span style={exceeded ? { color: WARNING_COLOR, fontWeight: 600 } : undefined}>
            {exceeded
                ? sprintf(
                    /* translators: 1: Current number of characters. 2: Recommended maximum number of characters. */
                    __('%1$d / %2$d characters – longer than recommended', 'odiseiaframework'),
                    count,
                    limit
                )
                : sprintf(
                    /* translators: 1: Current number of characters. 2: Recommended maximum number of characters. */
                    __('%1$d / %2$d characters', 'odiseiaframework'),
                    count,
                    limit
                )}
        </span>
    );
};

const SeoSidebar = () => {
    const { metaTitle, metaDescription, focusKeyword, setMeta } = useSeoMeta();

    return (
        <PanelBody title={__('SEO Settings', 'odiseiaframework')}>
            <PanelRow>
                <TextControl
                    label={__('Meta Title', 'odiseiaframework')}
                    value={metaTitle}
                    onChange={(value) => setMeta('_meta_title', value)}
                    help={
                        <>
                            <span style={{ display: 'block', color: HINT_COLOR }}>
                                {__('Used as the full page title. Leave empty to use the default.', 'odiseiaframework')}
                            </span>
                            <CharacterCounter value={metaTitle} limit={TITLE_LIMIT} />
                        </>
                    }
                />
            </PanelRow>
            <PanelRow>
                <TextareaControl
                    label={__('Meta Description', 'odiseiaframework')}
                    value={metaDescription}
                    onChange={(value) => setMeta('_meta_description', value)}
                    help={<CharacterCounter value={metaDescription} limit={DESCRIPTION_LIMIT} />}
                />
            </PanelRow>
            <PanelRow>
                <TextControl
                    label={__('Focus keyword', 'odiseiaframework')}
                    value={focusKeyword}
                    onChange={(value) => setMeta('_meta_focus_keyword', value)}
                    help={__(
                        'The main search phrase this content should rank for. Used only for the SEO checks below.',
                        'odiseiaframework'
                    )}
                />
            </PanelRow>
        </PanelBody>
    );
};

const AISeoAnalysis = () => {
    const { metaTitle, metaDescription, focusKeyword, setMeta } = useSeoMeta();
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const analyzeContent = async () => {
        setLoading(true);
        setError(null);

        // Read the content only when analyzing: serializing the post on every render is expensive.
        const content = select(editorStore).getEditedPostContent();
        // The meta title is the complete page title; without it, send the title WordPress renders by default.
        const currentTitle = metaTitle || composeDefaultTitle(selectTitleContext(select));

        try {
            const response = await apiFetch({
                path: '/odiseia-seo-tool/v1/analyze-content',
                method: 'POST',
                data: {
                    content,
                    title: currentTitle,
                },
            });

            // The endpoint returns { rating, suggestions, focus_keyphrases, description } directly.
            setAnalysis(response);
        } catch (err) {
            setAnalysis(null);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const suggestions = Array.isArray(analysis?.suggestions) ? analysis.suggestions : [];
    // The server already removes duplicates; deduplicate again in case a filter or proxy changed the response.
    const keyphrases = uniqueKeyphrases(analysis?.focus_keyphrases);
    const description = typeof analysis?.description === 'string' ? analysis.description : '';

    return (
        <PanelBody title={__('AI SEO Suggestions', 'odiseiaframework')} initialOpen={true}>
            <Button variant="primary" onClick={analyzeContent} disabled={loading}>
                {loading ? <Spinner /> : __('Analyze with AI', 'odiseiaframework')}
            </Button>

            {error && (
                <Notice status="error" isDismissible={false}>
                    {error.message || __('The content could not be analyzed.', 'odiseiaframework')}
                    {error.data?.connectors_url && (
                        <>
                            {' '}
                            <a href={error.data.connectors_url}>
                                {__('Open Settings > Connectors', 'odiseiaframework')}
                            </a>
                        </>
                    )}
                </Notice>
            )}

            {analysis && (
                <div className="seo-analysis-results">
                    {typeof analysis.rating === 'number' && (
                        <h4>{__('Title rating:', 'odiseiaframework')} {analysis.rating}/10</h4>
                    )}
                    {suggestions.length > 0 && (
                        <>
                            <h5>{__('Title suggestions (click to use as Meta Title):', 'odiseiaframework')}</h5>
                            <ul>
                                {suggestions.map((title, index) => (
                                    <li key={index}>
                                        <Button variant="link" onClick={() => setMeta('_meta_title', title)}>
                                            {title}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    {description && (
                        <>
                            <h5>{__('Suggested meta description:', 'odiseiaframework')}</h5>
                            <p style={{ marginBottom: 4 }}>{description}</p>
                            <p style={{ marginTop: 0 }}>
                                <CharacterCounter value={description} limit={DESCRIPTION_LIMIT} />
                            </p>
                            <Button
                                variant="secondary"
                                onClick={() => setMeta('_meta_description', description)}
                                disabled={metaDescription === description}
                            >
                                {__('Use this description', 'odiseiaframework')}
                            </Button>
                        </>
                    )}
                    {keyphrases.length > 0 && (
                        <>
                            <h5>
                                {__(
                                    'Suggested focus keyphrases (click to use as Focus keyword, click again to clear):',
                                    'odiseiaframework'
                                )}
                            </h5>
                            <div
                                role="group"
                                aria-label={__('Suggested focus keyphrases', 'odiseiaframework')}
                                style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                            >
                                {keyphrases.map((keyphrase) => {
                                    // The SEO checks read the edited meta, so they update as soon as this changes.
                                    const isSelected = isSameKeyphrase(keyphrase, focusKeyword);
                                    return (
                                        <Button
                                            key={keyphrase}
                                            variant="secondary"
                                            size="compact"
                                            // Button renders `isPressed` as `aria-pressed`.
                                            isPressed={isSelected}
                                            // Clicking the selected suggestion clears the focus keyword.
                                            onClick={() => setMeta('_meta_focus_keyword', isSelected ? '' : keyphrase)}
                                        >
                                            {keyphrase}
                                        </Button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </PanelBody>
    );
};

const previewStyles = {
    card: {
        fontFamily: 'Arial, Helvetica, sans-serif',
        background: '#fff',
        border: '1px solid #dadce0',
        borderRadius: 8,
        padding: 12,
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
    },
    icon: {
        width: 26,
        height: 26,
        flexShrink: 0,
        borderRadius: '50%',
        border: '1px solid #ecedef',
        background: '#f1f3f4',
        objectFit: 'cover',
        boxSizing: 'border-box',
    },
    letterIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#5f6368',
        fontSize: 13,
        lineHeight: 1,
    },
    siteInfo: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        lineHeight: '18px',
    },
    siteName: {
        color: '#202124',
        fontSize: 14,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    url: {
        color: '#4d5156',
        fontSize: 12,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    title: {
        display: 'block',
        margin: '8px 0 4px',
        color: '#1a0dab',
        fontSize: 20,
        lineHeight: '26px',
        fontWeight: 400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    description: {
        color: '#4d5156',
        fontSize: 14,
        lineHeight: '22px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
    },
};

const SearchPreview = () => {
    const { metaTitle, metaDescription } = useSeoMeta();
    // Values are kept flat so useSelect's shallow comparison can skip unrelated store updates.
    const { excerpt, permalink, ...titleContext } = useSelect((sel) => {
        const editor = sel(editorStore);
        return {
            excerpt: editor.getEditedPostAttribute('excerpt') || '',
            permalink: editor.getPermalink() || editor.getEditedPostAttribute('link') || '',
            ...selectTitleContext(sel),
        };
    }, []);

    // DOMParser's textContent already decodes entities such as `&amp;`.
    const excerptText = stripHtml(excerpt);
    const needsContentFallback = !metaDescription && !excerptText;

    // Subscribe to block changes only when the content summary is actually displayed.
    const blocks = useSelect(
        // Only a change signal. The edited `blocks` attribute avoids getEditorBlocks(), which serializes the post.
        (sel) => (needsContentFallback ? sel(editorStore).getEditedPostAttribute('blocks') : null),
        [needsContentFallback]
    );
    const [contentSummary, setContentSummary] = useState('');
    const computeContentSummary = useCallback(() => {
        const text = stripHtml(select(editorStore).getEditedPostContent());
        setContentSummary(Array.from(text).slice(0, DESCRIPTION_LIMIT * 2).join(''));
    }, []);
    // Serializing the whole post is expensive, so do it at most once per typing pause.
    const scheduleContentSummary = useDebounce(computeContentSummary, 500);

    useEffect(() => {
        if (needsContentFallback) {
            scheduleContentSummary();
        }
    }, [blocks, needsContentFallback, scheduleContentSummary]);

    const { site, siteName } = titleContext;
    const siteUrl = site?.home || site?.url || '';
    const iconUrl = site?.site_icon_url || '';
    const breadcrumb = buildBreadcrumb(permalink || siteUrl);
    const iconLetter = (Array.from((siteName || breadcrumb).trim())[0] || '?').toUpperCase();

    // The meta title replaces the complete document title, so it is shown exactly as entered.
    const fullTitle = metaTitle || composeDefaultTitle(titleContext) || __('(no title)', 'odiseiaframework');
    const fullDescription = metaDescription || excerptText || (needsContentFallback ? contentSummary : '');

    return (
        <PanelBody title={__('Search Preview', 'odiseiaframework')} initialOpen={true}>
            <div className="odiseia-search-preview" style={previewStyles.card}>
                <div style={previewStyles.header}>
                    {iconUrl ? (
                        <img src={iconUrl} alt="" width={26} height={26} style={previewStyles.icon} />
                    ) : (
                        <span aria-hidden="true" style={{ ...previewStyles.icon, ...previewStyles.letterIcon }}>
                            {iconLetter}
                        </span>
                    )}
                    <div style={previewStyles.siteInfo}>
                        <span style={previewStyles.siteName}>{siteName}</span>
                        <span style={previewStyles.url}>{breadcrumb}</span>
                    </div>
                </div>
                <span style={previewStyles.title} title={fullTitle}>
                    {truncate(fullTitle, TITLE_LIMIT)}
                </span>
                <div style={previewStyles.description}>
                    {fullDescription
                        ? truncate(fullDescription, DESCRIPTION_LIMIT)
                        : __('Add a meta description to control the text shown here.', 'odiseiaframework')}
                </div>
            </div>
        </PanelBody>
    );
};

// WordPress admin palette colors with at least 4.5:1 contrast on white.
const RATING_COLORS = {
    good: '#008a20',
    'needs-improvement': '#b26200',
    poor: '#d63638',
};

const STATUS_DISPLAY = {
    [STATUS.PASS]: { icon: 'yes-alt', color: RATING_COLORS.good },
    [STATUS.WARNING]: { icon: 'warning', color: RATING_COLORS['needs-improvement'] },
    [STATUS.FAIL]: { icon: 'dismiss', color: RATING_COLORS.poor },
    [STATUS.INFO]: { icon: 'info-outline', color: HINT_COLOR },
};

const getRatingLabel = (rating) => {
    switch (rating) {
        case 'good':
            return __('Good', 'odiseiaframework');
        case 'needs-improvement':
            return __('Needs improvement', 'odiseiaframework');
        default:
            return __('Poor', 'odiseiaframework');
    }
};

const getStatusLabel = (status) => {
    switch (status) {
        case STATUS.PASS:
            return __('Passed:', 'odiseiaframework');
        case STATUS.WARNING:
            return __('Warning:', 'odiseiaframework');
        case STATUS.FAIL:
            return __('Problem:', 'odiseiaframework');
        default:
            return __('Information:', 'odiseiaframework');
    }
};

const checkStyles = {
    summary: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    score: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '4px solid',
        boxSizing: 'border-box',
        fontSize: 16,
        fontWeight: 600,
    },
    list: {
        listStyle: 'none',
        margin: '0 0 12px',
        padding: 0,
    },
    item: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 10,
    },
    icon: {
        flexShrink: 0,
    },
    fix: {
        display: 'block',
        marginTop: 2,
        color: HINT_COLOR,
        fontSize: 12,
    },
    note: {
        margin: 0,
        color: HINT_COLOR,
        fontSize: 12,
    },
};

/**
 * Deterministic SEO checks (see ./seo/checks.js), updated live while editing.
 */
const SeoChecks = () => {
    const { metaTitle, metaDescription, focusKeyword } = useSeoMeta();
    const { blocks, slug, generatedSlug, slugInUrl, postTitle, siteName, tagline, isFrontPage } = useSelect(
        (sel) => {
            const editor = sel(editorStore);
            return {
                // Not getEditorBlocks() on every change: its cache check calls getEditedPostContent(),
                // which serializes the whole post. The block editor adds the `blocks` edit on the
                // first change only, so an unedited post falls back to getEditorBlocks(), which then
                // parses the saved content string once (memoized) without serializing.
                blocks: editor.getEditedPostAttribute('blocks') ?? editor.getEditorBlocks(),
                slug: editor.getEditedPostAttribute('slug') || '',
                // The slug, or the one WordPress creates from the title on publish.
                generatedSlug: String(editor.getEditedPostSlug() || ''),
                // False with plain permalinks or other structures without %postname%/%pagename%.
                slugInUrl: editor.isPermalinkEditable(),
                ...selectTitleContext(sel),
            };
        },
        []
    );

    // Blocks change on every keystroke, so the content is analyzed at most once per typing
    // pause. Unchanged blocks are cached by analyzeBlocks(); field checks update immediately.
    const [debouncedBlocks, setDebouncedBlocks] = useState(blocks);
    const scheduleBlocksUpdate = useDebounce(setDebouncedBlocks, 300);
    useEffect(() => {
        scheduleBlocksUpdate(blocks);
    }, [blocks, scheduleBlocksUpdate]);
    const content = useMemo(() => analyzeBlocks(debouncedBlocks, getBlockType), [debouncedBlocks]);

    // Same title the search preview shows: the meta title, or the default document title.
    const effectiveTitle = metaTitle.trim()
        ? metaTitle
        : composeDefaultTitle({ postTitle, siteName, tagline, isFrontPage });

    const { checks, score, rating } = useMemo(
        () =>
            runSeoChecks({
                metaTitle,
                effectiveTitle,
                metaDescription,
                focusKeyword,
                slug,
                generatedSlug,
                slugInUrl,
                isFrontPage,
                content,
            }),
        [metaTitle, effectiveTitle, metaDescription, focusKeyword, slug, generatedSlug, slugInUrl, isFrontPage, content]
    );

    const ratingColor = RATING_COLORS[rating];

    return (
        <PanelBody title={__('SEO checks', 'odiseiaframework')} initialOpen={true}>
            <div style={checkStyles.summary}>
                <span aria-hidden="true" style={{ ...checkStyles.score, borderColor: ratingColor, color: ratingColor }}>
                    {score}
                </span>
                <div>
                    <strong style={{ display: 'block', color: ratingColor }}>{getRatingLabel(rating)}</strong>
                    <span>
                        {sprintf(
                            /* translators: %d: SEO score from 0 to 100. */
                            __('SEO score: %d out of 100', 'odiseiaframework'),
                            score
                        )}
                    </span>
                </div>
            </div>
            <ul style={checkStyles.list}>
                {checks.map((item) => {
                    const display = STATUS_DISPLAY[item.status] || STATUS_DISPLAY[STATUS.INFO];
                    return (
                        <li key={item.id} style={checkStyles.item}>
                            <span
                                className={`dashicons dashicons-${display.icon}`}
                                aria-hidden="true"
                                style={{ ...checkStyles.icon, color: display.color }}
                            />
                            <div>
                                <VisuallyHidden>{getStatusLabel(item.status)} </VisuallyHidden>
                                {item.message}
                                {item.fix && <span style={checkStyles.fix}>{item.fix}</span>}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <p style={checkStyles.note}>
                {__(
                    'Based on the Google SEO Starter Guide. The score only reflects these checks, not how a page ranks.',
                    'odiseiaframework'
                )}
            </p>
        </PanelBody>
    );
};

/**
 * Renders the sidebar only for SEO post types. In the Site Editor the same `core/editor`
 * store holds templates, template parts, patterns, or nothing at all, so the plugin
 * renders nothing (not even the more-menu item) unless a supported post is loaded.
 */
const SeoToolsPlugin = () => {
    const postType = useSelect((sel) => sel(editorStore).getCurrentPostType(), []);

    if (!postType || !POST_TYPES.includes(postType)) {
        return null;
    }

    return (
        <>
            <PluginSidebarMoreMenuItem target={SIDEBAR_NAME}>
                {__('SEO Tools', 'odiseiaframework')}
            </PluginSidebarMoreMenuItem>
            <PluginSidebar name={SIDEBAR_NAME} title={__('SEO Tools', 'odiseiaframework')}>
                <SeoSidebar />
                <AISeoAnalysis />
                <SearchPreview />
                <SeoChecks />
            </PluginSidebar>
        </>
    );
};

registerPlugin('odiseia-seo-tools', {
    icon: 'admin-settings',
    render: SeoToolsPlugin,
});
