/**
 * Internal dependencies
 */
import { ALLOWED_TAXONOMIES } from './validation';

/**
 * Converts the admin form's React state into the definition payload shape the REST API expects
 * (see `Definition::normalize()` in includes/cpt_builder/definition.php).
 *
 * The form keeps taxonomies as a `{ [taxonomy]: boolean }` checkbox map (one boolean per
 * CheckboxControl) and fields as `{ id, key, label, type }` rows (the `id` only exists so React
 * can key the repeater list); the API wants a plain array of checked taxonomy names and fields
 * without the UI-only `id`.
 *
 * The form only edits a subset of the schema (slug, labels, taxonomies, fields): settings such
 * as `description`, `public`, `has_archive`, `hierarchical`, and `menu_icon` have no control in
 * the UI yet, but the REST update replaces the whole stored definition. Passing the definition
 * being edited as `base` keeps those untouched settings instead of resetting them to
 * `Definition::normalize()`'s defaults. `schema_version` and `supports` from `base` are harmless
 * to carry over since `normalize()` always recomputes both.
 *
 * @param {Object}                 formState
 * @param {string}                 formState.slug
 * @param {string}                 formState.singularLabel
 * @param {string}                 formState.pluralLabel
 * @param {Object<string, boolean>} formState.taxonomies
 * @param {Array<{id: string, key: string, label: string, type: string}>} formState.fields
 * @param {Object}                 [base] Definition being edited (entry.definition), or omitted
 *                                         when creating.
 * @return {Object} Definition payload ready for `POST`/`PUT /definitions`.
 */
export function buildDefinitionPayload(formState, base = {}) {
    const { slug, singularLabel, pluralLabel, taxonomies, fields } = formState;

    return {
        ...base,
        slug,
        labels: {
            singular: singularLabel,
            plural: pluralLabel,
        },
        taxonomies: ALLOWED_TAXONOMIES.filter((taxonomy) => Boolean((taxonomies || {})[taxonomy])),
        fields: (fields || []).map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type,
        })),
    };
}
