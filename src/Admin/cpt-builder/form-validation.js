/**
 * Internal dependencies
 */
import { validateFieldKey, validateFieldType, validateLabel, validateSlug } from './validation';

/**
 * Validates the admin form's full state and returns errors in the exact `{ path, code }` shape
 * the REST API returns (see `Definition::validate()`), so the same `error-map.js` message lookup
 * renders both client-side and server-side errors without a second copy of any message.
 *
 * @param {Object}      formState               See payload.js's buildDefinitionPayload() for shape.
 * @param {Object}      [options]
 * @param {string[]}    [options.reservedSlugs] From `window.odiseiaCptBuilderSettings`.
 * @param {string[]}    [options.existingSlugs] Slugs of every other stored definition.
 * @param {string|null} [options.currentSlug]   Slug of the definition being edited, if any.
 * @return {Array<{path: string, code: string}>} Empty when the form is valid.
 */
export function validateFormState(formState, options = {}) {
    const { reservedSlugs = [], existingSlugs = [], currentSlug = null } = options;
    const errors = [];

    const slugError = validateSlug(formState.slug, { reservedSlugs, existingSlugs, currentSlug });
    if (slugError) {
        errors.push({ path: 'slug', code: slugError });
    }

    if (validateLabel(formState.singularLabel)) {
        errors.push({ path: 'labels.singular', code: 'required' });
    }
    if (validateLabel(formState.pluralLabel)) {
        errors.push({ path: 'labels.plural', code: 'required' });
    }

    const seenKeys = [];
    (formState.fields || []).forEach((field, index) => {
        const keyError = validateFieldKey(field.key, seenKeys);
        if (keyError) {
            errors.push({ path: `fields.${index}.key`, code: keyError });
        } else {
            seenKeys.push(field.key);
        }

        if (validateLabel(field.label)) {
            errors.push({ path: `fields.${index}.label`, code: 'required' });
        }

        if (validateFieldType(field.type)) {
            errors.push({ path: `fields.${index}.type`, code: 'invalid' });
        }
    });

    return errors;
}
