/**
 * Internal dependencies
 */
import { validateFormState } from '../form-validation';

const validForm = () => ({
    slug: 'book',
    singularLabel: 'Book',
    pluralLabel: 'Books',
    taxonomies: { category: true, post_tag: false },
    fields: [{ id: 'row-1', key: 'price', label: 'Price', type: 'number' }],
});

describe('validateFormState', () => {
    it('returns no errors for a fully valid form', () => {
        expect(validateFormState(validForm())).toEqual([]);
    });

    it('reports an invalid slug using the same path/code shape as the REST API', () => {
        const errors = validateFormState({ ...validForm(), slug: 'Book Name' });

        expect(errors).toContainEqual({ path: 'slug', code: 'invalid_format' });
    });

    it('reports a slug already used by another definition', () => {
        const errors = validateFormState(validForm(), { existingSlugs: ['book'] });

        expect(errors).toContainEqual({ path: 'slug', code: 'conflict' });
    });

    it('does not flag the slug against its own current registration while editing', () => {
        const errors = validateFormState(validForm(), { existingSlugs: ['book'], currentSlug: 'book' });

        expect(errors.find((error) => 'slug' === error.path)).toBeUndefined();
    });

    it('reports missing singular and plural labels independently', () => {
        const errors = validateFormState({ ...validForm(), singularLabel: '', pluralLabel: '  ' });

        expect(errors).toContainEqual({ path: 'labels.singular', code: 'required' });
        expect(errors).toContainEqual({ path: 'labels.plural', code: 'required' });
    });

    it('reports an invalid field key, missing field label, and invalid field type by row index', () => {
        const errors = validateFormState({
            ...validForm(),
            fields: [{ id: 'row-1', key: 'Bad Key', label: '', type: 'richtext' }],
        });

        expect(errors).toContainEqual({ path: 'fields.0.key', code: 'invalid_format' });
        expect(errors).toContainEqual({ path: 'fields.0.label', code: 'required' });
        expect(errors).toContainEqual({ path: 'fields.0.type', code: 'invalid' });
    });

    it('reports a duplicate field key only on the second occurrence', () => {
        const errors = validateFormState({
            ...validForm(),
            fields: [
                { id: 'row-1', key: 'price', label: 'Price', type: 'number' },
                { id: 'row-2', key: 'price', label: 'Other Price', type: 'number' },
            ],
        });

        expect(errors.filter((error) => 'fields.0.key' === error.path)).toHaveLength(0);
        expect(errors).toContainEqual({ path: 'fields.1.key', code: 'duplicate' });
    });
});
