/**
 * Internal dependencies
 */
import { validateFieldKey, validateFieldType, validateLabel, validateSlug } from '../validation';

describe('validateSlug', () => {
    it('rejects an empty or malformed slug', () => {
        expect(validateSlug('')).toBe('invalid_format');
        expect(validateSlug('1book')).toBe('invalid_format');
        expect(validateSlug('Book')).toBe('invalid_format');
        expect(validateSlug('book name')).toBe('invalid_format');
        expect(validateSlug(undefined)).toBe('invalid_format');
    });

    it('accepts lowercase letters, digits, underscores, and hyphens starting with a letter', () => {
        expect(validateSlug('book')).toBeNull();
        expect(validateSlug('book-review_v2')).toBeNull();
    });

    it('rejects a slug longer than 20 characters', () => {
        expect(validateSlug('a'.repeat(20))).toBeNull();
        expect(validateSlug('a'.repeat(21))).toBe('too_long');
    });

    it('rejects a slug prefixed with wp_', () => {
        expect(validateSlug('wp_book')).toBe('reserved_prefix');
    });

    it('rejects a slug on the server-provided reserved list', () => {
        expect(validateSlug('page', { reservedSlugs: ['page', 'post'] })).toBe('reserved');
        expect(validateSlug('author', { reservedSlugs: ['author'] })).toBe('reserved');
    });

    it('rejects a slug already used by another post type', () => {
        expect(validateSlug('book', { existingSlugs: ['book'] })).toBe('conflict');
    });

    it('allows a slug to "conflict" with its own current registration', () => {
        expect(validateSlug('book', { existingSlugs: ['book'], currentSlug: 'book' })).toBeNull();
    });

    it('checks format before length, prefix, reserved list, or conflict', () => {
        expect(validateSlug('Wp_Book', { reservedSlugs: ['wp_book'], existingSlugs: ['wp_book'] })).toBe(
            'invalid_format'
        );
    });
});

describe('validateFieldKey', () => {
    it('rejects an empty or malformed key', () => {
        expect(validateFieldKey('')).toBe('invalid_format');
        expect(validateFieldKey('1price')).toBe('invalid_format');
        expect(validateFieldKey('Price')).toBe('invalid_format');
        expect(validateFieldKey(undefined)).toBe('invalid_format');
    });

    it('accepts lowercase letters, digits, and underscores up to 40 characters', () => {
        expect(validateFieldKey('price')).toBeNull();
        expect(validateFieldKey('a'.repeat(40))).toBeNull();
        expect(validateFieldKey('a'.repeat(41))).toBe('invalid_format');
    });

    it('rejects a key already used earlier in the same definition', () => {
        expect(validateFieldKey('price', ['price', 'title'])).toBe('duplicate');
    });

    it('does not flag a key against itself', () => {
        expect(validateFieldKey('price', ['title'])).toBeNull();
    });
});

describe('validateFieldType', () => {
    it('accepts every type supported by the registrar', () => {
        ['text', 'number', 'date', 'url', 'image'].forEach((type) => {
            expect(validateFieldType(type)).toBeNull();
        });
    });

    it('rejects an unknown or missing type', () => {
        expect(validateFieldType('richtext')).toBe('invalid');
        expect(validateFieldType(undefined)).toBe('invalid');
    });
});

describe('validateLabel', () => {
    it('requires a non-empty, non-whitespace-only label', () => {
        expect(validateLabel('')).toBe('required');
        expect(validateLabel('   ')).toBe('required');
        expect(validateLabel(undefined)).toBe('required');
    });

    it('accepts any trimmed non-empty string', () => {
        expect(validateLabel('Book')).toBeNull();
        expect(validateLabel('  Book  ')).toBeNull();
    });
});
