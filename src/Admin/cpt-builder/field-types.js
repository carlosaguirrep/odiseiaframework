/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { FIELD_TYPES } from './validation';

/**
 * Display metadata for the field-type SelectControl in FieldsEditor: a translated label and a
 * Dashicon name per type. `FIELD_TYPES` (imported from validation.js, which mirrors
 * `Definition::FIELD_TYPES`) stays the single source of truth for which types exist — this module
 * only adds how each one is presented, it never redefines the list itself.
 */
const FIELD_TYPE_LABELS = {
    text: __('Text', 'odiseiaframework'),
    number: __('Number', 'odiseiaframework'),
    date: __('Date', 'odiseiaframework'),
    url: __('URL', 'odiseiaframework'),
    image: __('Image', 'odiseiaframework'),
};

const FIELD_TYPE_ICONS = {
    text: 'editor-textcolor',
    number: 'calculator',
    date: 'calendar-alt',
    url: 'admin-links',
    image: 'format-image',
};

const FALLBACK_ICON = 'admin-generic';

/**
 * Options for the field-type SelectControl, in the same order as `FIELD_TYPES`.
 *
 * @return {Array<{value: string, label: string}>}
 */
export function getFieldTypeOptions() {
    return FIELD_TYPES.map((type) => ({
        value: type,
        label: FIELD_TYPE_LABELS[type] || type,
    }));
}

/**
 * The Dashicon name shown next to a field row for the given type.
 *
 * @param {string} type Field type.
 * @return {string} Dashicon name (without the `dashicons-` prefix), or a generic fallback icon
 *                   when the type is not recognized.
 */
export function getFieldTypeIcon(type) {
    return FIELD_TYPE_ICONS[type] || FALLBACK_ICON;
}
