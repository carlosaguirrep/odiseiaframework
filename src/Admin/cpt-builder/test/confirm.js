/**
 * Internal dependencies
 */
import { isConfirmRequired, isConfirmSatisfied } from '../confirm';

describe('isConfirmRequired', () => {
    it('is false when there are no posts at stake', () => {
        expect(isConfirmRequired(0)).toBe(false);
    });

    it('is true as soon as there is at least one post', () => {
        expect(isConfirmRequired(1)).toBe(true);
        expect(isConfirmRequired(5)).toBe(true);
    });
});

describe('isConfirmSatisfied', () => {
    it('is satisfied with any input when no posts exist', () => {
        expect(isConfirmSatisfied('', 'book', 0)).toBe(true);
        expect(isConfirmSatisfied('wrong', 'book', 0)).toBe(true);
    });

    it('requires an exact match to the slug when posts exist', () => {
        expect(isConfirmSatisfied('book', 'book', 3)).toBe(true);
        expect(isConfirmSatisfied('boo', 'book', 3)).toBe(false);
        expect(isConfirmSatisfied('', 'book', 3)).toBe(false);
    });

    it('is case-sensitive, matching the REST API exact string comparison', () => {
        // See Storage::trash()/delete_permanently() in includes/cpt_builder/storage.php:
        // `$confirm !== $slug` is a strict string comparison, never case-folded.
        expect(isConfirmSatisfied('BOOK', 'book', 2)).toBe(false);
    });

    it('does not trim whitespace, matching the REST API exact string comparison', () => {
        expect(isConfirmSatisfied('book ', 'book', 2)).toBe(false);
        expect(isConfirmSatisfied(' book', 'book', 2)).toBe(false);
    });
});
