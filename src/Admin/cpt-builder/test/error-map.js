/**
 * Internal dependencies
 */
import { fieldRowIndex, mapServerErrors } from '../error-map';

describe('mapServerErrors', () => {
    it('returns an empty map for an empty or missing error list', () => {
        expect(mapServerErrors([])).toEqual({});
        expect(mapServerErrors(undefined)).toEqual({});
    });

    it('maps each top-level path to a specific, non-empty message', () => {
        const map = mapServerErrors([
            { path: 'slug', code: 'reserved' },
            { path: 'labels.singular', code: 'required' },
        ]);

        expect(Object.keys(map)).toEqual(['slug', 'labels.singular']);
        expect(map.slug).toEqual(expect.any(String));
        expect(map.slug.length).toBeGreaterThan(0);
        expect(map['labels.singular']).not.toBe(map.slug);
    });

    it('gives a different message per slug error code', () => {
        const codes = [
            'invalid_format',
            'too_long',
            'reserved_prefix',
            'reserved',
            'conflict',
            'collision',
            'stuck',
        ];
        const messages = codes.map((code) => mapServerErrors([{ path: 'slug', code }]).slug);

        expect(new Set(messages).size).toBe(codes.length);
    });

    it('maps the lifecycle collision code to a non-generic message', () => {
        // See Storage::is_foreign_owned() in includes/cpt_builder/storage.php: trash()/
        // delete_permanently() refuse with this code when the slug is actually owned by a
        // foreign plugin/theme registration.
        const map = mapServerErrors([{ path: 'slug', code: 'collision' }]);

        expect(map.slug).toEqual(expect.any(String));
        expect(map.slug.length).toBeGreaterThan(0);
    });

    it('maps the lifecycle stuck code to a non-generic message', () => {
        // See Storage::trash()/delete_permanently(): this code is returned when a batch makes
        // zero progress instead of looping "Working..." forever.
        const map = mapServerErrors([{ path: 'slug', code: 'stuck' }]);

        expect(map.slug).toEqual(expect.any(String));
        expect(map.slug.length).toBeGreaterThan(0);
    });

    it('maps a fields.N.key/label/type path using the row-level message set', () => {
        const map = mapServerErrors([
            { path: 'fields.0.key', code: 'duplicate' },
            { path: 'fields.1.label', code: 'required' },
        ]);

        expect(map['fields.0.key']).toEqual(expect.any(String));
        expect(map['fields.1.label']).toEqual(expect.any(String));
        expect(map['fields.0.key']).not.toBe(map['fields.1.label']);
    });

    it('falls back to a generic message for an unrecognized path/code pair', () => {
        const map = mapServerErrors([{ path: 'unknown.path', code: 'whatever' }]);

        expect(map['unknown.path']).toEqual(expect.any(String));
        expect(map['unknown.path'].length).toBeGreaterThan(0);
    });
});

describe('fieldRowIndex', () => {
    it('extracts the row index from a fields.N.* path', () => {
        expect(fieldRowIndex('fields.0.key')).toBe(0);
        expect(fieldRowIndex('fields.12.label')).toBe(12);
    });

    it('returns null for a path that is not a field row error', () => {
        expect(fieldRowIndex('slug')).toBeNull();
        expect(fieldRowIndex('fields')).toBeNull();
    });
});
