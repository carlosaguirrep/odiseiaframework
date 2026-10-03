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

    it('keeps settings not covered by the form from the base definition (edit round trip)', () => {
        const base = {
            schema_version: 1,
            slug: 'book',
            labels: { singular: 'Old Book', plural: 'Old Books' },
            description: 'A book definition.',
            public: true,
            has_archive: false,
            hierarchical: true,
            menu_icon: 'dashicons-book-alt',
            supports: ['title', 'editor', 'thumbnail', 'excerpt', 'revisions'],
            taxonomies: ['category'],
            fields: [{ key: 'old_field', label: 'Old Field', type: 'text' }],
        };

        const payload = buildDefinitionPayload(
            {
                slug: 'book',
                singularLabel: 'Book',
                pluralLabel: 'Books',
                taxonomies: { category: false, post_tag: true },
                fields: [{ id: 'row-1', key: 'price', label: 'Price', type: 'number' }],
            },
            base
        );

        expect(payload).toEqual({
            schema_version: 1,
            slug: 'book',
            labels: { singular: 'Book', plural: 'Books' },
            description: 'A book definition.',
            public: true,
            has_archive: false,
            hierarchical: true,
            menu_icon: 'dashicons-book-alt',
            supports: ['title', 'editor', 'thumbnail', 'excerpt', 'revisions'],
            taxonomies: ['post_tag'],
            fields: [{ key: 'price', label: 'Price', type: 'number' }],
        });
    });

    it('behaves exactly as before when no base definition is given (create)', () => {
        const payload = buildDefinitionPayload({
            slug: 'book',
            singularLabel: 'Book',
            pluralLabel: 'Books',
            taxonomies: { category: true },
            fields: [{ id: 'row-1', key: 'price', label: 'Price', type: 'number' }],
        });

        expect(payload).toEqual({
            slug: 'book',
            labels: { singular: 'Book', plural: 'Books' },
            taxonomies: ['category'],
            fields: [{ key: 'price', label: 'Price', type: 'number' }],
        });
    });
});
