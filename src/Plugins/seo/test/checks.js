/**
 * Internal dependencies
 */
import {
    STATUS,
    containsPhrase,
    getRating,
    getScore,
    isGenericAnchor,
    isReadableSlug,
    runSeoChecks,
    slugContainsPhrase,
    slugVariants,
    slugify,
} from '../checks';

const repeat = (character, length) => character.repeat(length);

const emptyContent = { text: '', headings: [], paragraphCount: 0, imageAlts: [], linkTexts: [] };

const baseInput = (overrides = {}) => ({
    metaTitle: 'Best hiking trails in Patagonia for beginners',
    effectiveTitle: 'Best hiking trails in Patagonia for beginners',
    metaDescription:
        'Discover the best hiking trails in Patagonia for beginners, with maps, difficulty levels and the best season to go.',
    focusKeyword: 'hiking trails',
    slug: 'hiking-trails-patagonia',
    generatedSlug: 'hiking-trails-patagonia',
    slugInUrl: true,
    isFrontPage: false,
    content: { ...emptyContent, text: 'These hiking trails are easy.' },
    ...overrides,
});

const findCheck = (result, id) => result.checks.find((item) => item.id === id);
const statusOf = (result, id) => findCheck(result, id)?.status;

describe('containsPhrase', () => {
    it('matches case-insensitively', () => {
        expect(containsPhrase('HIKING Trails are fun', 'hiking trails')).toBe(true);
    });

    it('matches accent-insensitively in both directions', () => {
        expect(containsPhrase('Guía de café en Bogotá', 'guia de cafe')).toBe(true);
        expect(containsPhrase('Guia de cafe en Bogota', 'Guía de Café')).toBe(true);
    });

    it('matches whole phrases only', () => {
        expect(containsPhrase('Cars and caravans', 'car')).toBe(false);
        expect(containsPhrase('A car, a bike', 'car')).toBe(true);
        expect(containsPhrase('hiking-trails', 'hiking trails')).toBe(false);
    });

    it('tolerates extra whitespace and escapes regular expression characters', () => {
        expect(containsPhrase('Learn  C++\n basics', 'c++ basics')).toBe(true);
        expect(containsPhrase('Learn C basics', 'c++ basics')).toBe(false);
    });

    it('never matches an empty phrase', () => {
        expect(containsPhrase('anything', '   ')).toBe(false);
    });

    it('treats typographic and ASCII apostrophes and quotes as equal', () => {
        expect(containsPhrase('Don’t panic guide', "don't panic")).toBe(true);
        expect(containsPhrase("Don't panic guide", 'Don’t panic')).toBe(true);
        expect(containsPhrase('The “best” trails', '"best" trails')).toBe(true);
    });
});

describe('slug helpers', () => {
    it('slugifies like sanitize_title with the transliteration used for every locale', () => {
        expect(slugify('Guía de Café: ¡Bogotá!')).toBe('guia-de-cafe-bogota');
        expect(slugify("Don't panic")).toBe('dont-panic');
        expect(slugify('Don’t panic')).toBe('dont-panic');
        expect(slugify('Rock & Roll: Guide')).toBe('rock-roll-guide');
        expect(slugify('ß ł ø æ đ')).toBe('s-l-o-ae-d');
        expect(slugify('Müller Straße')).toBe('muller-strase');
        expect(slugify('%d0%bf%d1%80%d0%b8%d0%b2%d0%b5%d1%82')).toBe('привет');
    });

    it('lists the generic and locale-specific slug forms of a phrase', () => {
        expect(slugVariants('Müller Straße')).toEqual(['muller-strase', 'mueller-strasse']);
        expect(slugVariants('Ærø')).toEqual(['aero', 'aeroe']);
        expect(slugVariants('Đakovo')).toEqual(['dakovo', 'djakovo']);
        expect(slugVariants('hiking trails')).toEqual(['hiking-trails']);
        expect(slugVariants(' ')).toEqual([]);
    });

    it('finds the keyword as whole slug segments', () => {
        expect(slugContainsPhrase('best-hiking-trails', 'Hiking Trails')).toBe(true);
        expect(slugContainsPhrase('guia-cafe-bogota', 'café bogotá')).toBe(true);
        expect(slugContainsPhrase('hikingtrails', 'hiking trails')).toBe(false);
        expect(slugContainsPhrase('cars', 'car')).toBe(false);
    });

    it('matches the slugs WordPress creates for generic and German locales', () => {
        // de_DE, de_CH, de_AT.
        expect(slugContainsPhrase('mueller-strasse', 'Müller Straße')).toBe(true);
        // Every other locale (remove_accents() maps ß to s).
        expect(slugContainsPhrase('muller-strase', 'Müller Straße')).toBe(true);
        // Not a slug WordPress creates for this keyword.
        expect(slugContainsPhrase('muller-strasse', 'Müller Straße')).toBe(false);
        expect(slugContainsPhrase('lodz-guide', 'Łódź')).toBe(true);
    });

    it('removes ampersands, colons, and apostrophes like sanitize_title', () => {
        expect(slugContainsPhrase('rock-roll', 'Rock & Roll')).toBe(true);
        expect(slugContainsPhrase('guide-part-2', 'Guide: Part 2')).toBe(true);
        expect(slugContainsPhrase('dont-panic-guide', 'Don’t panic')).toBe(true);
        expect(slugContainsPhrase('dont-panic-guide', "Don't panic")).toBe(true);
    });

    it.each([
        ['hiking-trails', true],
        ['mp3', true],
        ['ps5', true],
        ['iphone15', true],
        ['b2b', true],
        ['web3', true],
        ['猫', true],
        ['%e7%8c%ab', true],
        ['auto', true],
        ['copy', true],
        ['post', true],
        ['123', false],
        ['2024-05', false],
        ['post-123', false],
        ['untitled-2', false],
        ['auto-draft', false],
        ['a1b2c3d4e5f6a7b8', false],
        ['bcdfghjklmnp', false],
        ['p', false],
        ['', false],
    ])('isReadableSlug( %p ) is %p', (slug, expected) => {
        expect(isReadableSlug(slug)).toBe(expected);
    });
});

describe('isGenericAnchor', () => {
    it.each(['click here', 'Read more…', 'LEER MÁS »', 'leer mas', 'Haz clic aquí', 'aqui', '', '   ', '→'])(
        'treats %p as generic',
        (text) => {
            expect(isGenericAnchor(text)).toBe(true);
        }
    );

    it.each(['Read more about hiking trails', 'Patagonia trail map', 'más información sobre rutas'])(
        'treats %p as descriptive',
        (text) => {
            expect(isGenericAnchor(text)).toBe(false);
        }
    );
});

describe('score', () => {
    it('weights pass 1, warning 0.5, fail 0 and ignores info', () => {
        expect(
            getScore([
                { status: STATUS.PASS },
                { status: STATUS.WARNING },
                { status: STATUS.FAIL },
                { status: STATUS.INFO },
            ])
        ).toBe(50);
        expect(getScore([])).toBe(0);
    });

    it('rates good from 80, needs improvement from 50, poor below', () => {
        expect(getRating(80)).toBe('good');
        expect(getRating(79)).toBe('needs-improvement');
        expect(getRating(50)).toBe('needs-improvement');
        expect(getRating(49)).toBe('poor');
    });

    it('scores a fully optimized post 100', () => {
        const result = runSeoChecks(baseInput());
        expect(result.checks.every((item) => item.status === STATUS.PASS)).toBe(true);
        expect(result.score).toBe(100);
        expect(result.rating).toBe('good');
    });
});

describe('runSeoChecks', () => {
    describe('1. meta title set', () => {
        it('passes when set', () => {
            expect(statusOf(runSeoChecks(baseInput()), 'meta-title-set')).toBe(STATUS.PASS);
        });

        it('warns when empty or whitespace', () => {
            const result = runSeoChecks(baseInput({ metaTitle: '  ' }));
            expect(statusOf(result, 'meta-title-set')).toBe(STATUS.WARNING);
            expect(findCheck(result, 'meta-title-set').fix).not.toBe('');
        });
    });

    describe('2. title length', () => {
        it('passes from 30 to 60 characters', () => {
            expect(statusOf(runSeoChecks(baseInput({ metaTitle: repeat('a', 30) })), 'title-length')).toBe(STATUS.PASS);
            expect(statusOf(runSeoChecks(baseInput({ metaTitle: repeat('a', 60) })), 'title-length')).toBe(STATUS.PASS);
        });

        it('warns below 30 and above 60 characters', () => {
            expect(statusOf(runSeoChecks(baseInput({ metaTitle: repeat('a', 29) })), 'title-length')).toBe(
                STATUS.WARNING
            );
            const long = runSeoChecks(baseInput({ metaTitle: repeat('a', 61) }));
            expect(statusOf(long, 'title-length')).toBe(STATUS.WARNING);
            expect(findCheck(long, 'title-length').message).toContain('truncated');
        });

        it('counts emoji and accents as one character', () => {
            expect(statusOf(runSeoChecks(baseInput({ metaTitle: repeat('é', 60) })), 'title-length')).toBe(STATUS.PASS);
            expect(statusOf(runSeoChecks(baseInput({ metaTitle: repeat('😀', 30) })), 'title-length')).toBe(STATUS.PASS);
        });

        it('uses the effective default title when the meta title is empty', () => {
            const result = runSeoChecks(baseInput({ metaTitle: '', effectiveTitle: 'Short – Site' }));
            expect(statusOf(result, 'title-length')).toBe(STATUS.WARNING);
            expect(findCheck(result, 'title-length').message).toContain('12 characters');
        });
    });

    describe('3. meta description set', () => {
        it('passes when set and warns when empty', () => {
            expect(statusOf(runSeoChecks(baseInput()), 'meta-description-set')).toBe(STATUS.PASS);
            expect(statusOf(runSeoChecks(baseInput({ metaDescription: '' })), 'meta-description-set')).toBe(
                STATUS.WARNING
            );
        });
    });

    describe('4. description length', () => {
        it('passes from 70 to 160 characters', () => {
            expect(
                statusOf(runSeoChecks(baseInput({ metaDescription: repeat('a', 70) })), 'description-length')
            ).toBe(STATUS.PASS);
            expect(
                statusOf(runSeoChecks(baseInput({ metaDescription: repeat('a', 160) })), 'description-length')
            ).toBe(STATUS.PASS);
        });

        it('warns below 70 and above 160 characters', () => {
            expect(
                statusOf(runSeoChecks(baseInput({ metaDescription: repeat('a', 69) })), 'description-length')
            ).toBe(STATUS.WARNING);
            expect(
                statusOf(runSeoChecks(baseInput({ metaDescription: repeat('a', 161) })), 'description-length')
            ).toBe(STATUS.WARNING);
        });

        it('is not applicable without a description', () => {
            expect(findCheck(runSeoChecks(baseInput({ metaDescription: '' })), 'description-length')).toBeUndefined();
        });
    });

    describe('focus keyword missing', () => {
        it('replaces keyword checks with a single warning', () => {
            const result = runSeoChecks(baseInput({ focusKeyword: ' ' }));
            expect(statusOf(result, 'focus-keyword')).toBe(STATUS.WARNING);
            ['keyword-in-title', 'keyword-in-description', 'keyword-in-slug', 'keyword-in-headings', 'keyword-in-content'].forEach(
                (id) => expect(findCheck(result, id)).toBeUndefined()
            );
        });

        it('is not shown when a keyword is set', () => {
            expect(findCheck(runSeoChecks(baseInput()), 'focus-keyword')).toBeUndefined();
        });
    });

    describe('5. keyword in title', () => {
        it('passes and warns', () => {
            expect(statusOf(runSeoChecks(baseInput()), 'keyword-in-title')).toBe(STATUS.PASS);
            expect(statusOf(runSeoChecks(baseInput({ focusKeyword: 'kayak' })), 'keyword-in-title')).toBe(
                STATUS.WARNING
            );
        });

        it('checks the effective title when the meta title is empty', () => {
            const result = runSeoChecks(baseInput({ metaTitle: '', effectiveTitle: 'Rutas de Montaña – Site' }));
            expect(statusOf({ checks: result.checks }, 'keyword-in-title')).toBe(STATUS.WARNING);
            const accent = runSeoChecks(
                baseInput({ metaTitle: '', effectiveTitle: 'Rutas de Montaña – Site', focusKeyword: 'rutas de montana' })
            );
            expect(statusOf(accent, 'keyword-in-title')).toBe(STATUS.PASS);
        });
    });

    describe('6. keyword in description', () => {
        it('passes, warns, and is not applicable without a description', () => {
            expect(statusOf(runSeoChecks(baseInput()), 'keyword-in-description')).toBe(STATUS.PASS);
            expect(
                statusOf(runSeoChecks(baseInput({ metaDescription: repeat('word ', 20) })), 'keyword-in-description')
            ).toBe(STATUS.WARNING);
            expect(
                findCheck(runSeoChecks(baseInput({ metaDescription: '' })), 'keyword-in-description')
            ).toBeUndefined();
        });
    });

    describe('7. keyword in slug', () => {
        it('passes and warns', () => {
            expect(statusOf(runSeoChecks(baseInput()), 'keyword-in-slug')).toBe(STATUS.PASS);
            expect(statusOf(runSeoChecks(baseInput({ slug: 'patagonia-guide' })), 'keyword-in-slug')).toBe(
                STATUS.WARNING
            );
        });

        it('matches keywords with typographic apostrophes and German characters', () => {
            expect(
                statusOf(runSeoChecks(baseInput({ focusKeyword: 'don’t panic', slug: 'dont-panic' })), 'keyword-in-slug')
            ).toBe(STATUS.PASS);
            expect(
                statusOf(runSeoChecks(baseInput({ focusKeyword: 'Müller Straße', slug: 'mueller-strasse' })), 'keyword-in-slug')
            ).toBe(STATUS.PASS);
        });

        it('uses the generated slug when no slug is set yet', () => {
            expect(
                statusOf(runSeoChecks(baseInput({ slug: '', generatedSlug: 'best-hiking-trails' })), 'keyword-in-slug')
            ).toBe(STATUS.PASS);
        });

        it('is not applicable for the front page or when the URL has no slug', () => {
            expect(findCheck(runSeoChecks(baseInput({ isFrontPage: true })), 'keyword-in-slug')).toBeUndefined();
            expect(findCheck(runSeoChecks(baseInput({ slugInUrl: false })), 'keyword-in-slug')).toBeUndefined();
        });
    });

    describe('8. keyword in headings', () => {
        it('passes, warns, and is not applicable without headings', () => {
            const withHeading = (headings) =>
                runSeoChecks(baseInput({ content: { ...baseInput().content, headings } }));
            expect(statusOf(withHeading(['Top Hiking Trails']), 'keyword-in-headings')).toBe(STATUS.PASS);
            expect(statusOf(withHeading(['Gear list']), 'keyword-in-headings')).toBe(STATUS.WARNING);
            expect(findCheck(withHeading([]), 'keyword-in-headings')).toBeUndefined();
        });
    });

    describe('9. keyword in content', () => {
        it('passes and fails', () => {
            expect(statusOf(runSeoChecks(baseInput()), 'keyword-in-content')).toBe(STATUS.PASS);
            expect(
                statusOf(runSeoChecks(baseInput({ content: { ...emptyContent, text: 'Nothing here.' } })), 'keyword-in-content')
            ).toBe(STATUS.FAIL);
        });
    });

    describe('10. readable slug', () => {
        it('passes and warns', () => {
            expect(statusOf(runSeoChecks(baseInput()), 'readable-slug')).toBe(STATUS.PASS);
            expect(statusOf(runSeoChecks(baseInput({ slug: 'post-123' })), 'readable-slug')).toBe(STATUS.WARNING);
        });

        it('shows neutral info when no slug is set yet, without affecting the score', () => {
            const result = runSeoChecks(baseInput({ slug: '', generatedSlug: 'hiking-trails' }));
            expect(statusOf(result, 'readable-slug')).toBe(STATUS.INFO);
            expect(result.score).toBe(100);
        });

        it('is not applicable for the front page or when the URL has no slug', () => {
            expect(findCheck(runSeoChecks(baseInput({ isFrontPage: true })), 'readable-slug')).toBeUndefined();
            expect(findCheck(runSeoChecks(baseInput({ slugInUrl: false })), 'readable-slug')).toBeUndefined();
        });
    });

    describe('11. headings in long content', () => {
        const withContent = (content) => runSeoChecks(baseInput({ content: { ...baseInput().content, ...content } }));

        it('is not applicable below 5 paragraphs', () => {
            expect(findCheck(withContent({ paragraphCount: 4 }), 'headings-long-content')).toBeUndefined();
        });

        it('passes with a heading and warns without one', () => {
            expect(
                statusOf(withContent({ paragraphCount: 5, headings: ['Hiking trails'] }), 'headings-long-content')
            ).toBe(STATUS.PASS);
            expect(statusOf(withContent({ paragraphCount: 5, headings: [] }), 'headings-long-content')).toBe(
                STATUS.WARNING
            );
        });
    });

    describe('12. image alt text', () => {
        const withImages = (imageAlts) =>
            runSeoChecks(baseInput({ content: { ...baseInput().content, imageAlts } }));

        it('is not applicable without images', () => {
            expect(findCheck(withImages([]), 'image-alt')).toBeUndefined();
        });

        it('passes when all images have alt text', () => {
            expect(statusOf(withImages(['A trail', 'A lake']), 'image-alt')).toBe(STATUS.PASS);
        });

        it('warns with the number of images missing alt text', () => {
            const result = withImages(['A trail', '', '  ', '', 'A lake']);
            expect(statusOf(result, 'image-alt')).toBe(STATUS.WARNING);
            expect(findCheck(result, 'image-alt').message).toBe('3 of 5 images have no alt text.');
        });
    });

    describe('13. link text', () => {
        const withLinks = (linkTexts) =>
            runSeoChecks(baseInput({ content: { ...baseInput().content, linkTexts } }));

        it('is not applicable without links', () => {
            expect(findCheck(withLinks([]), 'link-text')).toBeUndefined();
        });

        it('passes with descriptive link text', () => {
            expect(statusOf(withLinks(['Torres del Paine trail map']), 'link-text')).toBe(STATUS.PASS);
        });

        it('warns with the number of empty or generic links', () => {
            const result = withLinks(['Trail map', 'Click here', '', 'Leer más…']);
            expect(statusOf(result, 'link-text')).toBe(STATUS.WARNING);
            expect(findCheck(result, 'link-text').message).toBe('3 of 4 links have empty or generic text.');
        });
    });
});
