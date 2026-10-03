/**
 * Internal dependencies
 */
import { getFieldTypeIcon, getFieldTypeOptions } from '../field-types';

describe('getFieldTypeOptions', () => {
    it('returns one option per field type the registrar understands', () => {
        const options = getFieldTypeOptions();

        expect(options).toHaveLength(5);
        expect(options.map((option) => option.value)).toEqual(['text', 'number', 'date', 'url', 'image']);
    });

    it('gives each option a human-readable, non-empty label', () => {
        const options = getFieldTypeOptions();

        options.forEach((option) => {
            expect(typeof option.label).toBe('string');
            expect(option.label.length).toBeGreaterThan(0);
        });
    });
});

describe('getFieldTypeIcon', () => {
    it('maps every known field type to a distinct Dashicon name', () => {
        const icons = ['text', 'number', 'date', 'url', 'image'].map(getFieldTypeIcon);

        icons.forEach((icon) => expect(typeof icon).toBe('string'));
        expect(new Set(icons).size).toBe(icons.length);
    });

    it('falls back to a generic icon for an unknown type', () => {
        expect(getFieldTypeIcon('richtext')).toBe('admin-generic');
        expect(getFieldTypeIcon(undefined)).toBe('admin-generic');
    });
});
