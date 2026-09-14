/**
 * Deterministic SEO checks based on Google's SEO Starter Guide.
 *
 * @see https://developers.google.com/search/docs/fundamentals/seo-starter-guide
 *
 * By design there are no checks for keyword density, content length, the number or order of
 * headings, or meta keywords: the guide says those do not matter for Google Search. Title and
 * description lengths are checked because long values are truncated in search results, not
 * because length affects ranking.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { cleanForSlug } from '@wordpress/url';

import { countCharacters, normalizeQuotes, normalizeText, safeDecode } from './text';

export const STATUS = {
    PASS: 'pass',
    WARNING: 'warning',
    FAIL: 'fail',
    // Neutral information, not included in the score.
    INFO: 'info',
};

export const TITLE_LENGTH = { min: 30, max: 60 };
export const DESCRIPTION_LENGTH = { min: 70, max: 160 };

/**
 * Content with at least this many non-empty paragraphs is considered long.
 */
export const LONG_CONTENT_PARAGRAPHS = 5;

/**
 * Anchor texts that do not describe the destination (English and Spanish), matched exactly
 * after normalization.
 */
export const GENERIC_ANCHORS = [
    'click here',
    'here',
    'read more',
    'more',
    'link',
    'this link',
    'clic aquí',
    'haz clic aquí',
    'aquí',
    'leer más',
    'más',
    'ver más',
    'este enlace',
    'enlace',
];

/**
 * Slugs WordPress or authors use for placeholder URLs: `auto-draft`, or a placeholder word
 * followed by a number (`post-123`, `untitled-2`). The words alone (`post`, `copy`) are real words.
 */
const PLACEHOLDER_SLUG = /^(?:auto-draft(?:-\d+)*|(?:post|page|entry|untitled|draft|copy)(?:-\d+)+)$/;

/**
 * Characters WordPress remove_accents() transliterates for every locale that the
 * remove-accents package used by cleanForSlug() keeps as they are.
 */
const CORE_SLUG_CHARACTERS = { ß: 's' };

/**
 * Locale-specific remove_accents() rules (wp-includes/formatting.php). WordPress applies the
 * site locale when it creates a slug; slugs can also be edited by hand or created under another
 * locale, so a keyword matches when any of these transliterations is found.
 */
const LOCALE_SLUG_CHARACTERS = [
    // German: de_DE, de_CH, de_AT, and their formal and informal variants.
    { Ä: 'Ae', ä: 'ae', Ö: 'Oe', ö: 'oe', Ü: 'Ue', ü: 'ue', ẞ: 'SS', ß: 'ss' },
    // Danish: da_DK.
    { Æ: 'Ae', æ: 'ae', Ø: 'Oe', ø: 'oe', Å: 'Aa', å: 'aa' },
    // Serbian and Bosnian: sr_RS, bs_BA.
    { Đ: 'DJ', đ: 'dj' },
];

const STATUS_WEIGHTS = { [STATUS.PASS]: 1, [STATUS.WARNING]: 0.5, [STATUS.FAIL]: 0 };

const NORMALIZED_GENERIC_ANCHORS = new Set(GENERIC_ANCHORS.map((anchor) => normalizeText(anchor)));

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether a text contains a phrase as a whole phrase, ignoring case and accents.
 *
 * @param {string} text   Text to search.
 * @param {string} phrase Phrase to find.
 * @return {boolean} True when the phrase is found.
 */
export const containsPhrase = (text, phrase) => {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase) {
        return false;
    }

    const pattern = normalizedPhrase.split(' ').map(escapeRegExp).join('\\s+');
    return new RegExp(`(?:^|[^\\p{L}\\p{M}\\p{N}])${pattern}(?=$|[^\\p{L}\\p{M}\\p{N}])`, 'u').test(
        normalizeText(text)
    );
};

/**
 * Converts text or a (possibly percent-encoded) slug to slug form with the editor's
 * cleanForSlug(), after applying transliterations it does not cover.
 *
 * @param {string} value      Text or slug.
 * @param {Object} characters Extra character replacements, e.g. a locale's rules.
 * @return {string} Slug.
 */
const toSlug = (value, characters = {}) => {
    const replacements = { ...CORE_SLUG_CHARACTERS, ...characters };
    const text = normalizeQuotes(safeDecode(String(value ?? ''))).normalize('NFC');
    return cleanForSlug(
        Array.from(text)
            .map((character) => replacements[character] ?? character)
            .join('')
    );
};

/**
 * Converts text or a (possibly percent-encoded) slug to comparable slug form, using the
 * transliteration WordPress applies for every locale. Like sanitize_title(), accents are
 * transliterated, quotes, `&`, and `:` are removed, and spaces become hyphens.
 *
 * @param {string} value Text or slug.
 * @return {string} Slug.
 */
export const slugify = (value) => toSlug(value);

/**
 * Slug forms WordPress can create for a phrase: the generic one and locale-specific ones.
 *
 * @param {string} phrase Phrase.
 * @return {string[]} Unique, non-empty slugs, generic first.
 */
export const slugVariants = (phrase) => [
    ...new Set([slugify(phrase), ...LOCALE_SLUG_CHARACTERS.map((characters) => toSlug(phrase, characters))]),
].filter(Boolean);

/**
 * Whether a slug contains a slug form of a phrase as whole segments.
 *
 * @param {string} slug   URL slug.
 * @param {string} phrase Phrase to find.
 * @return {boolean} True when found.
 */
export const slugContainsPhrase = (slug, phrase) => {
    const haystack = `-${slugify(slug)}-`;
    return slugVariants(phrase).some((variant) => haystack.includes(`-${variant}-`));
};

/**
 * Whether an ASCII slug segment looks random: 12 or more characters that are hexadecimal with
 * a digit, have no vowels, or are at least half digits.
 *
 * @param {string} segment Slug segment.
 * @return {boolean} True when hash-like.
 */
const isHashLikeSegment = (segment) => {
    if (segment.length < 12 || !/^[a-z0-9]+$/.test(segment)) {
        return false;
    }
    const digits = segment.replace(/\D/g, '').length;
    return (digits > 0 && /^[0-9a-f]+$/.test(segment)) || !/[aeiouy]/.test(segment) || digits * 2 >= segment.length;
};

/**
 * Whether a slug segment is a word: it has letters (digits allowed, as in `mp3` or `iphone15`),
 * is not hash-like, and is two or more characters long unless it is a non-Latin character (`猫`).
 *
 * @param {string} segment Slug segment.
 * @return {boolean} True when the segment is a word.
 */
const isWordSegment = (segment) =>
    /\p{L}/u.test(segment) &&
    !isHashLikeSegment(segment) &&
    (Array.from(segment).length >= 2 || /[^a-z0-9_]/.test(segment));

/**
 * Whether a slug has words that may be useful for users. Rejects numeric slugs (`123`),
 * placeholders (`post-123`, `untitled-2`, `auto-draft`), and hash-like slugs (`a1b2c3d4e5f6a7b8`).
 *
 * @param {string} slug URL slug.
 * @return {boolean} True when readable.
 */
export const isReadableSlug = (slug) => {
    const normalized = slugify(slug);
    return !!normalized && !PLACEHOLDER_SLUG.test(normalized) && normalized.split('-').some(isWordSegment);
};

/**
 * Whether a link text is empty or generic ("click here", "leer más", ...).
 *
 * @param {string} text Link text.
 * @return {boolean} True when the text does not describe the destination.
 */
export const isGenericAnchor = (text) => {
    const normalized = normalizeText(text).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return !normalized || NORMALIZED_GENERIC_ANCHORS.has(normalized);
};

/**
 * Score rating for a 0–100 score.
 *
 * @param {number} score Score.
 * @return {'good'|'needs-improvement'|'poor'} Rating.
 */
export const getRating = (score) => {
    if (score >= 80) {
        return 'good';
    }
    return score >= 50 ? 'needs-improvement' : 'poor';
};

/**
 * Score from 0 to 100: pass counts 1, warning 0.5, fail 0. Info checks are not scored.
 *
 * @param {{ status: string }[]} checks Applicable checks.
 * @return {number} Score.
 */
export const getScore = (checks) => {
    const scored = checks.filter((check) => check.status in STATUS_WEIGHTS);
    if (!scored.length) {
        return 0;
    }
    const total = scored.reduce((sum, check) => sum + STATUS_WEIGHTS[check.status], 0);
    return Math.round((total / scored.length) * 100);
};

const check = (id, status, message, fix = '') => ({ id, status, message, fix });

const titleLengthCheck = (title) => {
    const length = countCharacters(title);
    if (length < TITLE_LENGTH.min) {
        return check(
            'title-length',
            STATUS.WARNING,
            sprintf(
                /* translators: %d: Number of characters. */
                _n(
                    'The title is %d character long and could be more descriptive.',
                    'The title is %d characters long and could be more descriptive.',
                    length,
                    'odiseiaframework'
                ),
                length
            ),
            __('Describe the content of the page more specifically.', 'odiseiaframework')
        );
    }
    if (length > TITLE_LENGTH.max) {
        return check(
            'title-length',
            STATUS.WARNING,
            sprintf(
                /* translators: %d: Number of characters. */
                _n(
                    'The title is %d character long and may be truncated in search results.',
                    'The title is %d characters long and may be truncated in search results.',
                    length,
                    'odiseiaframework'
                ),
                length
            ),
            __('Shorten it or put the most important words first.', 'odiseiaframework')
        );
    }
    return check(
        'title-length',
        STATUS.PASS,
        sprintf(
            /* translators: %d: Number of characters. */
            _n(
                'The title is %d character long and fits in most search results.',
                'The title is %d characters long and fits in most search results.',
                length,
                'odiseiaframework'
            ),
            length
        )
    );
};

const descriptionLengthCheck = (description) => {
    const length = countCharacters(description);
    if (length < DESCRIPTION_LENGTH.min) {
        return check(
            'description-length',
            STATUS.WARNING,
            sprintf(
                /* translators: %d: Number of characters. */
                _n(
                    'The meta description is %d character long and may be too short to summarize the page.',
                    'The meta description is %d characters long and may be too short to summarize the page.',
                    length,
                    'odiseiaframework'
                ),
                length
            ),
            __('Summarize the most relevant points of the page in one or two sentences.', 'odiseiaframework')
        );
    }
    if (length > DESCRIPTION_LENGTH.max) {
        return check(
            'description-length',
            STATUS.WARNING,
            sprintf(
                /* translators: %d: Number of characters. */
                _n(
                    'The meta description is %d character long and may be truncated in search results.',
                    'The meta description is %d characters long and may be truncated in search results.',
                    length,
                    'odiseiaframework'
                ),
                length
            ),
            __('Shorten it or put the most important information first.', 'odiseiaframework')
        );
    }
    return check(
        'description-length',
        STATUS.PASS,
        sprintf(
            /* translators: %d: Number of characters. */
            _n(
                'The meta description is %d character long and fits in most search results.',
                'The meta description is %d characters long and fits in most search results.',
                length,
                'odiseiaframework'
            ),
            length
        )
    );
};

const keywordCheck = (id, found, passMessage, warningMessage, fix, missingStatus = STATUS.WARNING) =>
    found ? check(id, STATUS.PASS, passMessage) : check(id, missingStatus, warningMessage, fix);

/**
 * Runs every applicable SEO check.
 *
 * Checks that do not apply (e.g. image alt text when there are no images) are left out of
 * the list and the score.
 *
 * @param {Object}   input                        Values to check.
 * @param {string}   input.metaTitle              Meta title field.
 * @param {string}   input.effectiveTitle         Title shown in search results: the meta title or the default title.
 * @param {string}   input.metaDescription        Meta description field.
 * @param {string}   input.focusKeyword           Focus keyword field.
 * @param {string}   input.slug                   Slug saved or edited for the post; empty when not set yet.
 * @param {string}   input.generatedSlug          Slug WordPress would use (the slug, or one created from the title).
 * @param {boolean}  input.slugInUrl              Whether the permalink structure includes the slug.
 * @param {boolean}  input.isFrontPage            Whether the post is the static front page.
 * @param {Object}   input.content                Result of analyzeBlocks().
 * @param {string}   input.content.text           Content text.
 * @param {string[]} input.content.headings       Heading texts.
 * @param {number}   input.content.paragraphCount Number of non-empty paragraphs.
 * @param {string[]} input.content.imageAlts      Alt text of each image.
 * @param {string[]} input.content.linkTexts      Text of each link.
 * @return {{ checks: Object[], score: number, rating: string }} Checks, score, and rating.
 */
export const runSeoChecks = ({
    metaTitle = '',
    effectiveTitle = '',
    metaDescription = '',
    focusKeyword = '',
    slug = '',
    generatedSlug = '',
    slugInUrl = false,
    isFrontPage = false,
    content = {},
}) => {
    const text = content.text || '';
    const headings = Array.isArray(content.headings) ? content.headings : [];
    const paragraphCount = content.paragraphCount || 0;
    const imageAlts = Array.isArray(content.imageAlts) ? content.imageAlts : [];
    const linkTexts = Array.isArray(content.linkTexts) ? content.linkTexts : [];

    const title = String(metaTitle).trim() ? String(metaTitle) : String(effectiveTitle);
    const description = String(metaDescription).trim();
    const keyword = String(focusKeyword).trim();
    // The static front page URL is the site address, with no slug.
    const hasSlugInUrl = slugInUrl && !isFrontPage;
    const checks = [];

    // 1. Meta title.
    checks.push(
        String(metaTitle).trim()
            ? check('meta-title-set', STATUS.PASS, __('A meta title is set.', 'odiseiaframework'))
            : check(
                'meta-title-set',
                STATUS.WARNING,
                __('No meta title is set, so the default title is used.', 'odiseiaframework'),
                __('Write a unique title that describes this page.', 'odiseiaframework')
            )
    );

    // 2. Title length (truncation in search results).
    checks.push(titleLengthCheck(title.trim()));

    // 3. Meta description.
    checks.push(
        description
            ? check('meta-description-set', STATUS.PASS, __('A meta description is set.', 'odiseiaframework'))
            : check(
                'meta-description-set',
                STATUS.WARNING,
                __('No meta description is set, so search engines pick a snippet from the page.', 'odiseiaframework'),
                __('Summarize the page in a meta description.', 'odiseiaframework')
            )
    );

    // 4. Description length (truncation in search results).
    if (description) {
        checks.push(descriptionLengthCheck(description));
    }

    // 5–9. Focus keyword.
    if (!keyword) {
        checks.push(
            check(
                'focus-keyword',
                STATUS.WARNING,
                __('Set a focus keyword to enable keyword checks.', 'odiseiaframework'),
                __('Use the words people would search for to find this page.', 'odiseiaframework')
            )
        );
    } else {
        checks.push(
            keywordCheck(
                'keyword-in-title',
                containsPhrase(title, keyword),
                __('The focus keyword appears in the title.', 'odiseiaframework'),
                __('The focus keyword does not appear in the title.', 'odiseiaframework'),
                __('Use the focus keyword in the title where it reads naturally.', 'odiseiaframework')
            )
        );

        if (description) {
            checks.push(
                keywordCheck(
                    'keyword-in-description',
                    containsPhrase(description, keyword),
                    __('The focus keyword appears in the meta description.', 'odiseiaframework'),
                    __('The focus keyword does not appear in the meta description.', 'odiseiaframework'),
                    __('Mention the focus keyword in the meta description.', 'odiseiaframework')
                )
            );
        }

        if (hasSlugInUrl) {
            checks.push(
                keywordCheck(
                    'keyword-in-slug',
                    slugContainsPhrase(slug || generatedSlug, keyword),
                    __('The focus keyword appears in the URL slug.', 'odiseiaframework'),
                    __('The focus keyword does not appear in the URL slug.', 'odiseiaframework'),
                    __('Edit the slug in the post URL settings.', 'odiseiaframework')
                )
            );
        }

        if (headings.length) {
            checks.push(
                keywordCheck(
                    'keyword-in-headings',
                    headings.some((heading) => containsPhrase(heading, keyword)),
                    __('The focus keyword appears in a heading.', 'odiseiaframework'),
                    __('The focus keyword does not appear in any heading.', 'odiseiaframework'),
                    __('Use the focus keyword in a heading where it fits the section.', 'odiseiaframework')
                )
            );
        }

        checks.push(
            keywordCheck(
                'keyword-in-content',
                containsPhrase(text, keyword),
                __('The focus keyword appears in the content.', 'odiseiaframework'),
                __('The focus keyword does not appear in the content.', 'odiseiaframework'),
                __('Write about the topic using the words readers would search for.', 'odiseiaframework'),
                STATUS.FAIL
            )
        );
    }

    // 10. Readable URL slug.
    if (hasSlugInUrl) {
        if (!String(slug).trim()) {
            checks.push(
                check(
                    'readable-slug',
                    STATUS.INFO,
                    __('The URL slug will be created from the title when the content is published.', 'odiseiaframework')
                )
            );
        } else {
            checks.push(
                isReadableSlug(slug)
                    ? check('readable-slug', STATUS.PASS, __('The URL slug contains readable words.', 'odiseiaframework'))
                    : check(
                        'readable-slug',
                        STATUS.WARNING,
                        __('The URL slug has no readable words.', 'odiseiaframework'),
                        __('Use words that describe the page, separated by hyphens.', 'odiseiaframework')
                    )
            );
        }
    }

    // 11. Headings in long content.
    if (paragraphCount >= LONG_CONTENT_PARAGRAPHS) {
        checks.push(
            headings.length
                ? check('headings-long-content', STATUS.PASS, __('The content is broken up with headings.', 'odiseiaframework'))
                : check(
                    'headings-long-content',
                    STATUS.WARNING,
                    __('The content is long and has no headings.', 'odiseiaframework'),
                    __('Break up long content into sections with headings.', 'odiseiaframework')
                )
        );
    }

    // 12. Image alt text.
    if (imageAlts.length) {
        const total = imageAlts.length;
        const missing = imageAlts.filter((alt) => !String(alt).trim()).length;
        checks.push(
            missing
                ? check(
                    'image-alt',
                    STATUS.WARNING,
                    sprintf(
                        /* translators: 1: Number of images without alt text. 2: Total number of images. */
                        _n(
                            '%1$d of %2$d images has no alt text.',
                            '%1$d of %2$d images have no alt text.',
                            missing,
                            'odiseiaframework'
                        ),
                        missing,
                        total
                    ),
                    __('Describe each image in the Alternative text setting.', 'odiseiaframework')
                )
                : check(
                    'image-alt',
                    STATUS.PASS,
                    sprintf(
                        /* translators: %d: Number of images. */
                        _n('%d image has alt text.', 'All %d images have alt text.', total, 'odiseiaframework'),
                        total
                    )
                )
        );
    }

    // 13. Descriptive link text.
    if (linkTexts.length) {
        const total = linkTexts.length;
        const generic = linkTexts.filter(isGenericAnchor).length;
        checks.push(
            generic
                ? check(
                    'link-text',
                    STATUS.WARNING,
                    sprintf(
                        /* translators: 1: Number of links with empty or generic text. 2: Total number of links. */
                        _n(
                            '%1$d of %2$d links has empty or generic text.',
                            '%1$d of %2$d links have empty or generic text.',
                            generic,
                            'odiseiaframework'
                        ),
                        generic,
                        total
                    ),
                    __('Replace text such as “click here” with words that describe the linked page.', 'odiseiaframework')
                )
                : check(
                    'link-text',
                    STATUS.PASS,
                    sprintf(
                        /* translators: %d: Number of links. */
                        _n('%d link has descriptive text.', 'All %d links have descriptive text.', total, 'odiseiaframework'),
                        total
                    )
                )
        );
    }

    const score = getScore(checks);

    return { checks, score, rating: getRating(score) };
};
