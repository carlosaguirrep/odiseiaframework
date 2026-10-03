/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Maps the REST API's field-level error codes (see `Definition::validate()` in
 * includes/cpt_builder/definition.php, and the `{path, code}` shape documented on
 * `Rest_Controller::invalid_error()`) to a translated message, so a 400 response can be shown
 * inline next to the control it came from without the form needing its own copy of PHP's
 * validation rules.
 */
const TOP_LEVEL_MESSAGES = {
    slug: {
        invalid_format: __(
            'Slug must start with a lowercase letter and contain only lowercase letters, numbers, underscores, and hyphens.',
            'odiseiaframework'
        ),
        too_long: __('Slug must be 20 characters or fewer.', 'odiseiaframework'),
        reserved_prefix: __('Slug cannot start with "wp_".', 'odiseiaframework'),
        reserved: __('This slug is reserved by WordPress.', 'odiseiaframework'),
        conflict: __('This slug is already used by another post type.', 'odiseiaframework'),
        // Lifecycle-only codes (trash/restore/delete, see Storage::trash()/delete_permanently()
        // in includes/cpt_builder/storage.php), not returned by create/update validation.
        collision: __(
            'This post type is managed by another plugin or theme; this action cannot continue.',
            'odiseiaframework'
        ),
        stuck: __(
            'One or more posts could not be processed. Check for something blocking deletion and try again.',
            'odiseiaframework'
        ),
        // Returned by PUT /definitions/{slug} (see Rest_Controller::update_item()) when the
        // definition is already trashed and pending permanent delete.
        trashed: __(
            'This definition is trashed; restore it before editing.',
            'odiseiaframework'
        ),
    },
    'labels.singular': {
        required: __('Singular label is required.', 'odiseiaframework'),
    },
    'labels.plural': {
        required: __('Plural label is required.', 'odiseiaframework'),
    },
    fields: {
        too_many: __('A definition can have at most 30 fields.', 'odiseiaframework'),
    },
    taxonomies: {
        invalid: __('One of the selected taxonomies is not supported.', 'odiseiaframework'),
    },
};

const FIELD_ROW_MESSAGES = {
    key: {
        invalid_format: __(
            'Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.',
            'odiseiaframework'
        ),
        duplicate: __('This field key is already used by another field in this definition.', 'odiseiaframework'),
    },
    label: {
        required: __('Field label is required.', 'odiseiaframework'),
    },
    type: {
        invalid: __('Select a valid field type.', 'odiseiaframework'),
    },
};

const FIELD_ROW_PATH = /^fields\.(\d+)\.(key|label|type)$/;

const GENERIC_MESSAGE = __('This field is invalid.', 'odiseiaframework');

/**
 * Converts the REST API's `data.errors` list into a `{ [path]: message }` map ready to pass to
 * each control's `help`/error prop. An error whose path/code pair is not recognized still gets a
 * generic message instead of being silently dropped from the UI.
 *
 * @param {Array<{path: string, code: string}>} [errors]
 * @return {Object<string, string>}
 */
export function mapServerErrors(errors) {
    const map = {};

    (errors || []).forEach(({ path, code }) => {
        map[path] = messageFor(path, code);
    });

    return map;
}

/**
 * The 0-based field row index for a `fields.N.key`/`fields.N.label`/`fields.N.type` error path,
 * used by FieldsEditor to highlight the right repeater row.
 *
 * @param {string} path Error path.
 * @return {number|null}
 */
export function fieldRowIndex(path) {
    const match = FIELD_ROW_PATH.exec(path);

    return match ? Number(match[1]) : null;
}

function messageFor(path, code) {
    const rowMatch = FIELD_ROW_PATH.exec(path);
    if (rowMatch) {
        const [, , segment] = rowMatch;
        return (FIELD_ROW_MESSAGES[segment] && FIELD_ROW_MESSAGES[segment][code]) || GENERIC_MESSAGE;
    }

    return (TOP_LEVEL_MESSAGES[path] && TOP_LEVEL_MESSAGES[path][code]) || GENERIC_MESSAGE;
}
