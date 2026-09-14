/**
 * External dependencies
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * Internal dependencies
 */
import { STATUS, runSeoChecks } from '../checks';
import { analyzeBlocks } from '../content';

// Core block metadata of the WordPress install this plugin lives in
// (wp-content/plugins/odiseiaframework/src/Plugins/seo/test -> WordPress root).
const CORE_BLOCKS_DIR = path.resolve(__dirname, '../../../../../../../wp-includes/blocks');
const HAS_CORE_BLOCKS = existsSync(path.join(CORE_BLOCKS_DIR, 'paragraph', 'block.json'));

const coreBlockTypes = new Map();
const readCoreBlockType = (name) => {
    if (!coreBlockTypes.has(name)) {
        const file = path.join(CORE_BLOCKS_DIR, name.replace(/^core\//, ''), 'block.json');
        coreBlockTypes.set(name, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined);
    }
    return coreBlockTypes.get(name);
};

const richText = { type: 'rich-text', source: 'rich-text' };

// Used only when the WordPress install is not available, e.g. when the plugin is tested elsewhere.
const STUB_BLOCK_TYPES = {
    'core/paragraph': { attributes: { content: { ...richText, selector: 'p' } } },
    'core/heading': { attributes: { content: { ...richText, selector: 'h1,h2,h3,h4,h5,h6' } } },
    'core/image': { attributes: { caption: { ...richText, selector: 'figcaption' } } },
    'core/button': { attributes: { text: { ...richText } } },
    'core/table': {
        attributes: {
            body: {
                source: 'query',
                query: { cells: { source: 'query', query: { content: { ...richText } } } },
            },
        },
    },
    'core/group': { attributes: {} },
    'core/media-text': { attributes: {} },
    'core/cover': { attributes: {} },
};

// Real block.json attribute definitions when available, so attribute sources cannot drift.
const getBlockType = (name) =>
    (HAS_CORE_BLOCKS && name.startsWith('core/') ? readCoreBlockType(name) : undefined) ?? STUB_BLOCK_TYPES[name];

const block = (name, attributes = {}, innerBlocks = []) => ({ name, attributes, innerBlocks });

// Mimics RichTextData, which the editor stores for rich-text attributes.
const richValue = (html) => ({ toHTMLString: () => html });

const describeWithCore = HAS_CORE_BLOCKS ? describe : describe.skip;

describeWithCore('core block attributes read by content.js', () => {
    it.each([
        ['core/paragraph', { content: 'rich-text' }],
        ['core/heading', { content: 'rich-text' }],
        ['core/button', { text: 'rich-text', url: 'attribute' }],
        ['core/image', { url: 'attribute', alt: 'attribute', href: 'attribute' }],
        ['core/media-text', { mediaUrl: 'attribute', mediaAlt: 'attribute', href: 'attribute', mediaType: null, useFeaturedImage: null }],
        ['core/cover', { url: null, alt: null, backgroundType: null, hasParallax: null, isRepeated: null, useFeaturedImage: null }],
    ])('%s defines the attributes and sources', (name, expected) => {
        const { attributes } = readCoreBlockType(name);
        Object.entries(expected).forEach(([key, source]) => {
            expect(attributes).toHaveProperty(key);
            if (source) {
                expect(attributes[key].source).toBe(source);
            }
        });
    });

    it('core/table stores cell rich text inside query sources', () => {
        const { attributes } = readCoreBlockType('core/table');
        expect(attributes.body.source).toBe('query');
        expect(attributes.body.query.cells.source).toBe('query');
        expect(attributes.body.query.cells.query.content.source).toBe('rich-text');
    });
});

describe('analyzeBlocks', () => {
    it('returns an empty summary for no blocks', () => {
        expect(analyzeBlocks([], getBlockType)).toEqual({
            text: '',
            headings: [],
            paragraphCount: 0,
            imageAlts: [],
            linkTexts: [],
        });
    });

    it('extracts text, headings, paragraphs, and links, including inner blocks', () => {
        const summary = analyzeBlocks(
            [
                block('core/heading', { content: richValue('Hiking <em>trails</em>') }),
                block('core/group', {}, [
                    block('core/paragraph', { content: richValue('See <a href="/map">the trail map</a> &amp; more.') }),
                    block('core/paragraph', { content: '' }),
                    block('core/paragraph', { content: 'Plain text' }),
                ]),
            ],
            getBlockType
        );

        expect(summary.headings).toEqual(['Hiking trails']);
        expect(summary.paragraphCount).toBe(2);
        expect(summary.linkTexts).toEqual(['the trail map']);
        expect(summary.text).toBe('Hiking trails See the trail map & more. Plain text');
    });

    it('collects image alt text from image blocks and inline images, and image link text from alt', () => {
        const summary = analyzeBlocks(
            [
                block('core/image', { url: 'a.jpg', alt: 'Lake', caption: '' }),
                block('core/image', { url: 'b.jpg', alt: '' }),
                block('core/image', { alt: '' }), // Placeholder without an image.
                block('core/paragraph', { content: '<a href="/x"><img src="c.jpg" alt="Trail map"></a>' }),
            ],
            getBlockType
        );

        expect(summary.imageAlts).toEqual(['Lake', '', 'Trail map']);
        expect(summary.linkTexts).toEqual(['Trail map']);
    });

    it('counts linked Image and Media & Text blocks as links whose text is the alt text', () => {
        const summary = analyzeBlocks(
            [
                block('core/image', { url: 'a.jpg', alt: '', href: '/gallery' }),
                block('core/image', { url: 'b.jpg', alt: 'Lake map', href: '/map' }),
                block('core/image', { url: 'c.jpg', alt: '' }), // Not linked.
                block('core/media-text', { mediaUrl: 'd.jpg', mediaType: 'image', mediaAlt: '', href: '/tent' }),
            ],
            getBlockType
        );

        expect(summary.linkTexts).toEqual(['', 'Lake map', '']);
    });

    it('reports linked images without alt text in the link text check', () => {
        const content = analyzeBlocks(
            [
                block('core/image', { url: 'a.jpg', alt: '', href: '/gallery' }),
                block('core/image', { url: 'b.jpg', alt: 'Lake map', href: '/map' }),
            ],
            getBlockType
        );
        const linkCheck = runSeoChecks({ metaTitle: 'Title', content }).checks.find((item) => item.id === 'link-text');

        expect(linkCheck.status).toBe(STATUS.WARNING);
        expect(linkCheck.message).toBe('1 of 2 links has empty or generic text.');
    });

    it('handles media & text and cover images only when they render an img element', () => {
        const summary = analyzeBlocks(
            [
                block('core/media-text', { mediaUrl: 'a.jpg', mediaType: 'image', mediaAlt: 'Tent' }),
                block('core/media-text', { mediaUrl: 'a.mp4', mediaType: 'video', mediaAlt: '' }),
                block('core/cover', { url: 'c.jpg', backgroundType: 'image', alt: '' }),
                block('core/cover', { url: 'd.jpg', backgroundType: 'image', alt: '', hasParallax: true }),
                block('core/cover', { url: 'e.jpg', backgroundType: 'image', alt: '', useFeaturedImage: true }),
            ],
            getBlockType
        );

        expect(summary.imageAlts).toEqual(['Tent', '']);
    });

    it('treats buttons with a URL as links', () => {
        const summary = analyzeBlocks(
            [block('core/button', { url: '/more', text: richValue('Read more') }), block('core/button', { text: 'No link' })],
            getBlockType
        );

        expect(summary.linkTexts).toEqual(['Read more']);
    });

    it('reads rich text nested in query attributes such as table cells', () => {
        const summary = analyzeBlocks(
            [block('core/table', { body: [{ cells: [{ content: richValue('Trail') }, { content: 'Hiking trails' }] }] })],
            getBlockType
        );

        expect(summary.text).toBe('Trail Hiking trails');
    });

    it('parses classic and custom HTML blocks, ignoring scripts', () => {
        const summary = analyzeBlocks(
            [
                block('core/freeform', {
                    content:
                        '<h2>Classic heading</h2><p>One</p><p> </p><p><a href="/a">here</a></p><img src="x.jpg"><script>var hidden = 1;</script>',
                }),
            ],
            getBlockType
        );

        expect(summary.headings).toEqual(['Classic heading']);
        expect(summary.paragraphCount).toBe(2);
        expect(summary.linkTexts).toEqual(['here']);
        expect(summary.imageAlts).toEqual(['']);
        expect(summary.text).not.toContain('hidden');
    });

    it('ignores blocks without a registered type', () => {
        expect(analyzeBlocks([block('acme/unknown', { content: 'Secret' })], getBlockType).text).toBe('');
    });

    it('reuses cached results for unchanged attributes', () => {
        const attributes = { content: richValue('Cached') };
        const spy = jest.fn(getBlockType);
        analyzeBlocks([block('core/paragraph', attributes)], spy);
        analyzeBlocks([block('core/paragraph', attributes)], spy);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
