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
 * Converts a control's onChange value back into the value to store in post meta.
 *
 * Design: a cleared/empty control means "unset", not "store an empty/zero value" — every field
 * type maps that case to `null`, which `WP_REST_Meta_Fields::update_value()` treats as "reset the
 * field" and deletes the meta key entirely (see https://github.com/WordPress/wordpress-develop,
 * wp-includes/rest-api/fields/class-wp-rest-meta-fields.php), so an unset value reads back empty
 * on reload instead of a stored `0`/`""`. A non-empty value still mirrors exactly what
 * Registrar::sanitize_number()/sanitize_image() do server-side for the number/image types, so the
 * value shown immediately after a change (optimistic UI) matches what a page reload would show
 * once the server's own sanitize_callback has run.
 *
 * @param {string} fieldType    CPT field type.
 * @param {*}      controlValue Value coming from the control's onChange.
 * @return {string|number|null} Meta-ready value, or null to delete the meta.
 */
export function toMetaValue(fieldType, controlValue) {
    const controlType = getControlType(fieldType);

    if (CONTROL_TYPES.NUMBER === controlType) {
        if ('' === controlValue || null === controlValue || undefined === controlValue) {
            return null;
        }

        const number = parseFloat(controlValue);
        return Number.isFinite(number) ? number : null;
    }

    if (CONTROL_TYPES.IMAGE === controlType) {
        const id = parseInt(controlValue, 10);
        return Number.isFinite(id) && id > 0 ? id : null;
    }

    return 'string' === typeof controlValue && '' !== controlValue ? controlValue : null;
}

// Optional minus, then digits with an optional fraction ("1.", "1.05") or a leading-dot fraction (".5").
const COMPLETE_DECIMAL = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * Decides what a number control's typed draft means for the post meta. The control keeps the raw
 * typed string locally ("-", "1.", "1.0" are valid intermediate states while typing "-1.05"), so
 * only a draft that is empty (unset -> null) or parses to a finite number is written to meta;
 * anything else is left uncommitted instead of being normalized or turned into a meta delete.
 *
 * @param {string} draft Raw string typed in the number control.
 * @return {{commit: boolean, value?: number|null}} Whether to write, and the meta value to write.
 */
export function getNumberDraftChange(draft) {
    if (null === draft || undefined === draft) {
        return { commit: true, value: null };
    }

    const text = String(draft).trim();
    if ('' === text) {
        return { commit: true, value: null };
    }

    // Strict full-string check: parseFloat("1abc") === 1, so it cannot be used to validate.
    if (!COMPLETE_DECIMAL.test(text)) {
        return { commit: false };
    }

    const value = parseFloat(text);
    return Number.isFinite(value) ? { commit: true, value } : { commit: false };
}

/**
 * Whether a number control's local draft still represents the external meta value, i.e. the draft
 * must be kept as typed instead of being resynced from meta. An uncommittable draft ("-") never
 * reached meta, so it is always kept.
 *
 * @param {string} draft     Raw string typed in the number control.
 * @param {*}      metaValue Current raw post meta value.
 * @return {boolean} True when the draft should be kept.
 */
export function isDraftInSync(draft, metaValue) {
    const change = getNumberDraftChange(draft);
    if (!change.commit) {
        return true;
    }

    return change.value === toMetaValue('number', toControlValue('number', metaValue));
}
