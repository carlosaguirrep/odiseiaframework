/**
 * Internal dependencies
 */
import {
    CONTROL_TYPES,
    getControlType,
    getNumberDraftChange,
    isDraftInSync,
    toControlValue,
    toMetaValue,
} from '../controls';

describe('getControlType', () => {
    it('maps every CPT field type (see Definition::FIELD_TYPES) to a control type', () => {
        expect(getControlType('text')).toBe(CONTROL_TYPES.TEXT);
        expect(getControlType('number')).toBe(CONTROL_TYPES.NUMBER);
        expect(getControlType('date')).toBe(CONTROL_TYPES.DATE);
        expect(getControlType('url')).toBe(CONTROL_TYPES.URL);
        expect(getControlType('image')).toBe(CONTROL_TYPES.IMAGE);
    });

    it('falls back to the text control for an unknown field type', () => {
        expect(getControlType('richtext')).toBe(CONTROL_TYPES.TEXT);
        expect(getControlType(undefined)).toBe(CONTROL_TYPES.TEXT);
    });
});

describe('toControlValue', () => {
    it('passes a string value through for text/url fields', () => {
        expect(toControlValue('text', 'Hello')).toBe('Hello');
        expect(toControlValue('url', 'https://example.com')).toBe('https://example.com');
    });

    it('falls back to an empty string for a non-string text/url value', () => {
        expect(toControlValue('text', undefined)).toBe('');
        expect(toControlValue('text', null)).toBe('');
        expect(toControlValue('url', 0)).toBe('');
    });

    it('stringifies a numeric meta value for the number control', () => {
        expect(toControlValue('number', 42.5)).toBe('42.5');
        expect(toControlValue('number', 0)).toBe('0');
    });

    it('treats a missing number value as an empty string, not "0"', () => {
        expect(toControlValue('number', '')).toBe('');
        expect(toControlValue('number', null)).toBe('');
        expect(toControlValue('number', undefined)).toBe('');
    });

    it('passes a Y-m-d date string through unchanged', () => {
        expect(toControlValue('date', '2026-01-15')).toBe('2026-01-15');
    });

    it('coerces an attachment id to a positive integer for the image control', () => {
        expect(toControlValue('image', '42')).toBe(42);
        expect(toControlValue('image', 42)).toBe(42);
    });

    it('treats a missing/invalid attachment id as 0 for the image control', () => {
        expect(toControlValue('image', '')).toBe(0);
        expect(toControlValue('image', 0)).toBe(0);
        expect(toControlValue('image', 'not-a-number')).toBe(0);
        expect(toControlValue('image', undefined)).toBe(0);
    });
});

describe('toMetaValue', () => {
    it('passes a string value through for text/url/date fields', () => {
        expect(toMetaValue('text', 'Hello')).toBe('Hello');
        expect(toMetaValue('url', 'https://example.com')).toBe('https://example.com');
        expect(toMetaValue('date', '2026-01-15')).toBe('2026-01-15');
    });

    // Design: clearing a text/url/date control means "unset", not "store an empty string" — null
    // tells the REST meta field to delete the key entirely (see WP_REST_Meta_Fields::update_value()),
    // the same way an empty number/image control deletes its meta (see the next describe blocks).
    it('maps an empty/non-string text/url/date value to null so the REST update deletes the meta', () => {
        expect(toMetaValue('text', '')).toBe(null);
        expect(toMetaValue('url', '')).toBe(null);
        expect(toMetaValue('date', '')).toBe(null);
        expect(toMetaValue('text', undefined)).toBe(null);
        expect(toMetaValue('date', null)).toBe(null);
    });

    it('parses a number control value into a float, matching Registrar::sanitize_number()', () => {
        expect(toMetaValue('number', '42.5')).toBe(42.5);
        expect(toMetaValue('number', '0')).toBe(0);
    });

    // Design: "number / float or delete" — an empty or unparsable control value means "unset",
    // not the stored float 0, so it must map to null (delete) rather than Registrar::sanitize_number()'s
    // own 0 fallback (that fallback only guards a direct, non-empty REST write, never reached here).
    it('maps an empty/unparsable number control value to null so the REST update deletes the meta', () => {
        expect(toMetaValue('number', '')).toBe(null);
        expect(toMetaValue('number', 'not-a-number')).toBe(null);
        expect(toMetaValue('number', undefined)).toBe(null);
        expect(toMetaValue('number', null)).toBe(null);
    });

    it('coerces the image control value (attachment id) to a positive integer', () => {
        expect(toMetaValue('image', 42)).toBe(42);
        expect(toMetaValue('image', '42')).toBe(42);
    });

    // Design: a cleared/invalid image control (see the "Remove image" action) means "unset" too,
    // so it maps to null (delete) rather than Registrar::sanitize_image()'s own 0 fallback.
    it('maps a missing/invalid image control value to null so the REST update deletes the meta', () => {
        expect(toMetaValue('image', 0)).toBe(null);
        expect(toMetaValue('image', undefined)).toBe(null);
        expect(toMetaValue('image', null)).toBe(null);
    });
});

describe('getNumberDraftChange', () => {
    it('commits null for an empty draft (clears the meta)', () => {
        expect(getNumberDraftChange('')).toEqual({ commit: true, value: null });
    });

    it('commits the parsed number once the draft is a finite number', () => {
        expect(getNumberDraftChange('1.05')).toEqual({ commit: true, value: 1.05 });
        expect(getNumberDraftChange('-3')).toEqual({ commit: true, value: -3 });
        expect(getNumberDraftChange('1.')).toEqual({ commit: true, value: 1 });
    });

    it('does not commit intermediate typing states', () => {
        expect(getNumberDraftChange('-')).toEqual({ commit: false });
        expect(getNumberDraftChange('.')).toEqual({ commit: false });
        expect(getNumberDraftChange('e')).toEqual({ commit: false });
    });
});

describe('isDraftInSync', () => {
    it('keeps a draft that parses to the current meta value', () => {
        expect(isDraftInSync('1.0', 1)).toBe(true);
        expect(isDraftInSync('1.', '1')).toBe(true);
    });

    it('treats an empty or uncommittable draft as in sync with an unset meta', () => {
        expect(isDraftInSync('', undefined)).toBe(true);
        expect(isDraftInSync('-', undefined)).toBe(true);
        expect(isDraftInSync('', '')).toBe(true);
    });

    it('reports a draft out of sync when the external meta value differs', () => {
        expect(isDraftInSync('1.5', 2)).toBe(false);
        expect(isDraftInSync('1.5', undefined)).toBe(false);
        expect(isDraftInSync('', 4)).toBe(false);
    });
});
