/**
 * Client-side mirror of includes/cpt_builder/definition.php Definition::validate(), for instant
 * inline feedback in the admin form. PHP stays the single source of truth and re-validates on
 * save: these functions return the same error codes PHP does, by path, so the REST error shape
 * ({ path, code }) and this module's output can share one error-message lookup.
 *
 * `reservedSlugs` and `existingSlugs` are never hand-duplicated here: they come from the server
 * at runtime (see Definition::reserved_slugs_for_js(), read from `window.odiseiaCptBuilderSettings`
 * by the form, and the REST `/definitions` list respectively), so they can never drift from PHP.
 */

export const FIELD_TYPES = ['text', 'number', 'date', 'url', 'image'];

// Mirrors Definition::ALLOWED_TAXONOMIES — the only taxonomies a definition may associate with
// its CPT (see payload.js, which filters the form's checkbox state against this list).
export const ALLOWED_TAXONOMIES = ['category', 'post_tag'];

const SLUG_PATTERN = /^[a-z][a-z0-9_-]*$/;
const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

const MAX_SLUG_LENGTH = 20;

/**
 * Validates a CPT slug.
 *
 * @param {string}      slug                    Candidate slug.
 * @param {Object}      [options]
 * @param {string[]}    [options.reservedSlugs] Reserved slugs and query vars from the server
 *                                               (Definition::reserved_slugs_for_js()).
 * @param {string[]}    [options.existingSlugs] Slugs already registered as post types.
 * @param {string|null} [options.currentSlug]   Slug of the definition being edited: allowed to
 *                                               "conflict" with its own existing registration.
 * @return {string|null} Error code, or null when valid.
 */
export function validateSlug(slug, options = {}) {
    const { reservedSlugs = [], existingSlugs = [], currentSlug = null } = options;

    if (typeof slug !== 'string' || '' === slug || ! SLUG_PATTERN.test(slug)) {
        return 'invalid_format';
    }
    if (slug.length > MAX_SLUG_LENGTH) {
        return 'too_long';
    }
    if (slug.startsWith('wp_')) {
        return 'reserved_prefix';
    }
    if (reservedSlugs.includes(slug)) {
        return 'reserved';
    }
    if (slug !== currentSlug && existingSlugs.includes(slug)) {
        return 'conflict';
    }

    return null;
}

/**
 * Validates one field's key.
 *
 * @param {string}   key      Candidate field key.
 * @param {string[]} seenKeys Keys already accepted earlier in the same definition.
 * @return {string|null} Error code, or null when valid.
 */
export function validateFieldKey(key, seenKeys = []) {
    if (typeof key !== 'string' || '' === key || ! FIELD_KEY_PATTERN.test(key)) {
        return 'invalid_format';
    }
    if (seenKeys.includes(key)) {
        return 'duplicate';
    }

    return null;
}

/**
 * Validates a field's type against the types the registrar knows how to store.
 *
 * @param {string} type Candidate field type.
 * @return {string|null} Error code, or null when valid.
 */
export function validateFieldType(type) {
    return FIELD_TYPES.includes(type) ? null : 'invalid';
}

/**
 * Validates a required label (definition labels, field labels).
 *
 * @param {string} label Candidate label.
 * @return {string|null} Error code, or null when valid.
 */
export function validateLabel(label) {
    return typeof label === 'string' && '' !== label.trim() ? null : 'required';
}
