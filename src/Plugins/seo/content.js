/**
 * Extracts the data the SEO checks need from the editor's block tree.
 *
 * Reads block attributes only and never serializes the post. Callers should pass the edited
 * `blocks` attribute rather than `getEditorBlocks()`: in WordPress 7.1 that selector calls
 * getEditedPostContent() for its cache check, which serializes the whole post on every call.
 * HTML is parsed with DOMParser, which creates an inert document: scripts do not run and
 * images do not load.
 */
import { collapseWhitespace } from './text';

/**
 * Attribute sources whose value is HTML markup (rich text or raw HTML).
 */
const HTML_SOURCES = ['rich-text', 'html'];

/**
 * Blocks whose `content` attribute is a full HTML document fragment written by hand.
 */
const HTML_DOCUMENT_BLOCKS = ['core/freeform', 'core/html'];

/**
 * Per-block results, keyed by the block's attributes object. The block editor keeps that
 * object when only other blocks change, so unchanged blocks are not parsed again.
 *
 * @type {WeakMap<Object, Object>}
 */
const cache = new WeakMap();

/**
 * Returns the HTML string of an attribute value (string or RichTextData).
 *
 * @param {*} value Attribute value.
 * @return {string} HTML markup, or an empty string.
 */
const toHtml = (value) => {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value.toHTMLString === 'function') {
        return value.toHTMLString();
    }
    return '';
};

/**
 * Anchor text of a link. For image links, the image alt text acts as the anchor text.
 *
 * @param {Element} anchor Anchor element.
 * @return {string} Link text.
 */
const getLinkText = (anchor) => {
    const text = collapseWhitespace(anchor.textContent);
    if (text) {
        return text;
    }
    return collapseWhitespace(
        Array.from(anchor.querySelectorAll('img'))
            .map((image) => image.getAttribute('alt') || '')
            .join(' ')
    );
};

/**
 * Parses an HTML fragment and records its text, links, and images.
 *
 * @param {string} html   HTML markup.
 * @param {Object} result Per-block result to fill.
 * @return {{ body: (HTMLElement|null), text: string }} Parsed body (null for plain text) and its text.
 */
const readFragment = (html, result) => {
    // Rich text escapes `<` and `&`, so markup without them is plain text.
    if (!/[<&]/.test(html)) {
        const text = collapseWhitespace(html);
        result.texts.push(text);
        return { body: null, text };
    }

    const { body } = new window.DOMParser().parseFromString(html, 'text/html');
    body.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
    body.querySelectorAll('a[href]').forEach((anchor) => result.linkTexts.push(getLinkText(anchor)));
    body.querySelectorAll('img').forEach((image) => result.imageAlts.push(image.getAttribute('alt') || ''));

    const text = collapseWhitespace(body.textContent);
    result.texts.push(text);
    return { body, text };
};

/**
 * Collects HTML markup from an attribute, following `query` sources (e.g. table cells).
 *
 * @param {*}      value      Attribute value.
 * @param {Object} definition Attribute definition from the block type.
 * @param {string[]} fragments Collected markup.
 */
const collectFragments = (value, definition, fragments) => {
    if (!definition || value === null || value === undefined) {
        return;
    }

    if (HTML_SOURCES.includes(definition.source)) {
        const html = toHtml(value);
        if (html) {
            fragments.push(html);
        }
        return;
    }

    if (definition.source === 'query' && definition.query && Array.isArray(value)) {
        value.forEach((item) => {
            if (item && typeof item === 'object') {
                Object.entries(definition.query).forEach(([key, itemDefinition]) =>
                    collectFragments(item[key], itemDefinition, fragments)
                );
            }
        });
    }
};

/**
 * Alt text of the image a block renders as an `<img>` element, or null when it renders none.
 *
 * @param {string} name       Block name.
 * @param {Object} attributes Block attributes.
 * @return {string|null} Alt text (possibly empty), or null.
 */
const getBlockImageAlt = (name, attributes) => {
    switch (name) {
        case 'core/image':
            return attributes.url ? attributes.alt || '' : null;
        case 'core/media-text':
            return attributes.mediaUrl && attributes.mediaType === 'image' && !attributes.useFeaturedImage
                ? attributes.mediaAlt || ''
                : null;
        case 'core/cover':
            // With a parallax or repeated background the image is a CSS background, not an `<img>`.
            return attributes.url &&
                (attributes.backgroundType || 'image') === 'image' &&
                !attributes.useFeaturedImage &&
                !attributes.hasParallax &&
                !attributes.isRepeated
                ? attributes.alt || ''
                : null;
        default:
            return null;
    }
};

/**
 * Analyzes one block without its inner blocks.
 *
 * @param {Object}   block        Block object.
 * @param {Function} getBlockType Returns the registered block type for a block name.
 * @return {Object} Block result.
 */
const analyzeOwnBlock = (block, getBlockType) => {
    const { name } = block;
    const attributes = block.attributes || {};
    const result = { texts: [], headings: [], paragraphCount: 0, imageAlts: [], linkTexts: [] };

    if (HTML_DOCUMENT_BLOCKS.includes(name)) {
        const html = toHtml(attributes.content);
        if (html) {
            const { body } = readFragment(html, result);
            if (body) {
                body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
                    const text = collapseWhitespace(heading.textContent);
                    if (text) {
                        result.headings.push(text);
                    }
                });
                result.paragraphCount = Array.from(body.querySelectorAll('p')).filter((paragraph) =>
                    collapseWhitespace(paragraph.textContent)
                ).length;
            }
        }
        return result;
    }

    const definitions = getBlockType(name)?.attributes || {};
    const fragments = [];
    Object.entries(definitions).forEach(([key, definition]) =>
        collectFragments(attributes[key], definition, fragments)
    );
    const ownText = collapseWhitespace(fragments.map((html) => readFragment(html, result).text).join(' '));

    if (name === 'core/heading' && ownText) {
        result.headings.push(ownText);
    }
    if (name === 'core/paragraph' && ownText) {
        result.paragraphCount = 1;
    }
    // A button renders its URL on the wrapper `<a>`, and `text` is its only rich-text attribute.
    if (name === 'core/button' && attributes.url) {
        result.linkTexts.push(ownText);
    }

    const imageAlt = getBlockImageAlt(name, attributes);
    if (imageAlt !== null) {
        result.imageAlts.push(imageAlt);
        // Image and Media & Text wrap a linked image in `<a>`: the alt text is the anchor text,
        // so a linked image without alt text is a link without text.
        if (attributes.href) {
            result.linkTexts.push(imageAlt);
        }
    }

    return result;
};

/**
 * Extracts text, headings, paragraph count, image alt texts, and link texts from blocks.
 *
 * @param {Object[]} blocks       Editor blocks, including inner blocks.
 * @param {Function} getBlockType Returns the registered block type for a block name.
 * @return {{ text: string, headings: string[], paragraphCount: number, imageAlts: string[], linkTexts: string[] }}
 *         Content summary.
 */
export const analyzeBlocks = (blocks, getBlockType) => {
    const summary = { texts: [], headings: [], paragraphCount: 0, imageAlts: [], linkTexts: [] };

    const visit = (list) => {
        if (!Array.isArray(list)) {
            return;
        }
        list.forEach((block) => {
            if (!block || !block.name) {
                return;
            }

            const key = block.attributes && typeof block.attributes === 'object' ? block.attributes : null;
            let own = key ? cache.get(key) : undefined;
            if (!own || own.name !== block.name) {
                own = { name: block.name, ...analyzeOwnBlock(block, getBlockType) };
                if (key) {
                    cache.set(key, own);
                }
            }

            summary.texts.push(...own.texts);
            summary.headings.push(...own.headings);
            summary.paragraphCount += own.paragraphCount;
            summary.imageAlts.push(...own.imageAlts);
            summary.linkTexts.push(...own.linkTexts);

            visit(block.innerBlocks);
        });
    };

    visit(blocks);

    return {
        text: summary.texts.filter(Boolean).join(' '),
        headings: summary.headings,
        paragraphCount: summary.paragraphCount,
        imageAlts: summary.imageAlts,
        linkTexts: summary.linkTexts,
    };
};
