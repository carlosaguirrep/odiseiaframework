/**
 * Internal dependencies
 */
import { CONTROL_TYPES, getControlType, toControlValue, toMetaValue } from '../controls';

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

    it('falls back to an empty string for a non-string text/url/date value', () => {
        expect(toMetaValue('text', undefined)).toBe('');
        expect(toMetaValue('date', null)).toBe('');
    });

    it('parses a number control value into a float, matching Registrar::sanitize_number()', () => {
        expect(toMetaValue('number', '42.5')).toBe(42.5);
        expect(toMetaValue('number', '0')).toBe(0);
    });

    it('treats an unparsable number control value as 0, matching Registrar::sanitize_number()', () => {
        expect(toMetaValue('number', '')).toBe(0);
        expect(toMetaValue('number', 'not-a-number')).toBe(0);
        expect(toMetaValue('number', undefined)).toBe(0);
    });

    it('coerces the image control value (attachment id) to a positive integer', () => {
        expect(toMetaValue('image', 42)).toBe(42);
        expect(toMetaValue('image', '42')).toBe(42);
    });

    it('treats a missing/invalid image control value as 0, matching Registrar::sanitize_image()', () => {
        expect(toMetaValue('image', 0)).toBe(0);
        expect(toMetaValue('image', undefined)).toBe(0);
        expect(toMetaValue('image', null)).toBe(0);
    });
});
