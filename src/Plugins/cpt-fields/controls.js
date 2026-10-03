/**
 * Maps a CPT field type (see `Definition::FIELD_TYPES`) to the control used to edit its value in
 * the post editor's "CPT Fields" panel (see ../cpt-fields.js), and converts between the raw post
 * meta value and whatever value that control natively works with.
 *
 * Kept free of any `@wordpress/*` import on purpose, same as ../../Admin/cpt-builder/field-types.js:
 * a pure module is trivial to unit test and never needs the editor runtime to be present.
 */

/**
 * Control types used by the panel. Not 1:1 with field types forever (e.g. a future field type
 * could reuse the text control), so the panel switches on this, not on the field type directly.
 */
export const CONTROL_TYPES = {
    TEXT: 'text',
    NUMBER: 'number',
    DATE: 'date',
    URL: 'url',
    IMAGE: 'image',
};

const CONTROL_BY_FIELD_TYPE = {
    text: CONTROL_TYPES.TEXT,
    number: CONTROL_TYPES.NUMBER,
    date: CONTROL_TYPES.DATE,
    url: CONTROL_TYPES.URL,
    image: CONTROL_TYPES.IMAGE,
};

/**
 * @param {string} fieldType CPT field type.
 * @return {string} One of CONTROL_TYPES. Falls back to TEXT for an unrecognized field type,
 *                   so an unknown/future type still renders something editable instead of
 *                   crashing the panel.
 */
export function getControlType(fieldType) {
    return CONTROL_BY_FIELD_TYPE[fieldType] || CONTROL_TYPES.TEXT;
}

/**
 * Converts a raw post meta value (as read from the entity record, already sanitized server-side
 * by Registrar::meta_config()) into the value its control should display.
 *
 * @param {string} fieldType CPT field type.
 * @param {*}      metaValue Raw post meta value.
 * @return {string|number} Control-ready value.
 */
export function toControlValue(fieldType, metaValue) {
    const controlType = getControlType(fieldType);

    if (CONTROL_TYPES.IMAGE === controlType) {
        const id = parseInt(metaValue, 10);
        return Number.isFinite(id) && id > 0 ? id : 0;
    }

    if (CONTROL_TYPES.NUMBER === controlType) {
        // '' (never saved) must stay '' rather than becoming the string "0": a TextControl
        // showing "0" for an empty field would look like the developer deliberately typed it.
        return '' === metaValue || null === metaValue || undefined === metaValue ? '' : String(metaValue);
    }

    return 'string' === typeof metaValue ? metaValue : '';
}

/**
 * Converts a control's onChange value back into the value to store in post meta — mirroring
 * exactly what Registrar::sanitize_number()/sanitize_image() do server-side, so the value shown
 * immediately after a change (optimistic UI) matches what a page reload would show once the
 * server's own sanitize_callback has run.
 *
 * @param {string} fieldType    CPT field type.
 * @param {*}      controlValue Value coming from the control's onChange.
 * @return {string|number} Meta-ready value.
 */
export function toMetaValue(fieldType, controlValue) {
    const controlType = getControlType(fieldType);

    if (CONTROL_TYPES.NUMBER === controlType) {
        const number = parseFloat(controlValue);
        return Number.isFinite(number) ? number : 0;
    }

    if (CONTROL_TYPES.IMAGE === controlType) {
        const id = parseInt(controlValue, 10);
        return Number.isFinite(id) && id > 0 ? id : 0;
    }

    return 'string' === typeof controlValue ? controlValue : '';
}
