/**
 * Internal dependencies
 */
import { buildDefinitionPayload } from '../payload';

describe('buildDefinitionPayload', () => {
    it('builds a minimal payload from an empty form', () => {
        const payload = buildDefinitionPayload({
            slug: '',
            singularLabel: '',
            pluralLabel: '',
            taxonomies: {},
            fields: [],
        });

        expect(payload).toEqual({
            slug: '',
            labels: { singular: '', plural: '' },
            taxonomies: [],
            fields: [],
        });
    });

    it('keeps only the taxonomies checked true, in a fixed order', () => {
        const payload = buildDefinitionPayload({
            slug: 'book',
            singularLabel: 'Book',
            pluralLabel: 'Books',
            taxonomies: { category: true, post_tag: false },
            fields: [],
        });

        expect(payload.taxonomies).toEqual(['category']);
    });

    it('includes both taxonomies when both are checked', () => {
        const payload = buildDefinitionPayload({
            slug: 'book',
            singularLabel: 'Book',
            pluralLabel: 'Books',
            taxonomies: { category: true, post_tag: true },
            fields: [],
        });

        expect(payload.taxonomies).toEqual(['category', 'post_tag']);
    });

    it('strips the UI-only row id from each field, keeping only key/label/type', () => {
        const payload = buildDefinitionPayload({
            slug: 'book',
            singularLabel: 'Book',
            pluralLabel: 'Books',
            taxonomies: {},
            fields: [
                { id: 'row-1', key: 'price', label: 'Price', type: 'number' },
                { id: 'row-2', key: 'cover', label: 'Cover', type: 'image' },
            ],
        });

        expect(payload.fields).toEqual([
            { key: 'price', label: 'Price', type: 'number' },
            { key: 'cover', label: 'Cover', type: 'image' },
        ]);
    });
});
