/**
 * WordPress dependencies
 */
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { Button, PanelRow, TextControl } from '@wordpress/components';
import { useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { PluginDocumentSettingPanel, store as editorStore } from '@wordpress/editor';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import {
    CONTROL_TYPES,
    getControlType,
    getNumberDraftChange,
    isDraftInSync,
    toControlValue,
    toMetaValue,
} from './cpt-fields/controls';

const PANEL_NAME = 'odiseia-cpt-fields';

// Localized by Cpt_Builder::enqueue_fields_panel_assets(): one entry per active CPT slug, each an
// array of `{key, label, type}` (see Definition schema) — the same source of truth the Query
// Loop variation and the registrar use, so this panel can never list a field the CPT does not
// actually have.
const SETTINGS = window.odiseiaCptFieldsSettings || {};
const FIELDS_BY_POST_TYPE = SETTINGS.fields && 'object' === typeof SETTINGS.fields ? SETTINGS.fields : {};

/**
 * Number control with a local draft string: the raw typed text ("-", "1.", "1.0") is kept as
 * typed, and meta is only written when the draft is empty or a finite number. The draft is
 * resynced from meta only when meta changes to something the draft does not represent.
 */
function NumberField({ field, value, onChange }) {
    const [draft, setDraft] = useState(toControlValue(field.type, value));

    useEffect(() => {
        if (!isDraftInSync(draft, value)) {
            setDraft(toControlValue(field.type, value));
        }
        // Only an external meta change should resync; typing is handled in onChange.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <TextControl
            label={field.label}
            type="number"
            value={draft}
            onChange={(next) => {
                setDraft(next);
                const change = getNumberDraftChange(next);
                if (change.commit) {
                    onChange(change.value);
                }
            }}
        />
    );
}

/**
 * One control for one field, bound to the CURRENT post's own meta (already loaded by the editor
 * via core-data — every field's meta is registered with `show_in_rest => true`, see
 * Registrar::register_one(), so no extra REST call is needed here).
 */
function CptField({ field, value, onChange }) {
    const controlType = getControlType(field.type);
    const controlValue = toControlValue(field.type, value);

    if (CONTROL_TYPES.IMAGE === controlType) {
        return (
            <PanelRow>
                <MediaUploadCheck>
                    <MediaUpload
                        allowedTypes={['image']}
                        value={controlValue}
                        onSelect={(media) => onChange(toMetaValue(field.type, media && media.id))}
                        render={({ open }) => (
                            <Button onClick={open} variant="secondary">
                                {controlValue
                                    ? __('Replace image', 'odiseiaframework')
                                    : field.label}
                            </Button>
                        )}
                    />
                </MediaUploadCheck>
                {controlValue ? (
                    <Button
                        onClick={() => onChange(toMetaValue(field.type, 0))}
                        variant="tertiary"
                        isDestructive
                    >
                        {__('Remove image', 'odiseiaframework')}
                    </Button>
                ) : null}
            </PanelRow>
        );
    }

    if (CONTROL_TYPES.NUMBER === controlType) {
        return <NumberField field={field} value={value} onChange={onChange} />;
    }

    const inputType = CONTROL_TYPES.DATE === controlType ? 'date' : CONTROL_TYPES.URL === controlType ? 'url' : 'text';

    return (
        <TextControl
            label={field.label}
            type={inputType}
            value={controlValue}
            onChange={(next) => onChange(toMetaValue(field.type, next))}
        />
    );
}

/**
 * The "CPT Fields" document panel: renders only for a post type with at least one registered
 * field, with one control per field, reading/writing the post's own meta directly.
 */
function CptFieldsPanel() {
    const postType = useSelect((select) => select(editorStore).getCurrentPostType(), []);
    const fields = FIELDS_BY_POST_TYPE[postType] || [];
    const [meta, setMeta] = useEntityProp('postType', postType, 'meta');

    if (!fields.length) {
        return null;
    }

    return (
        <PluginDocumentSettingPanel name={PANEL_NAME} title={__('CPT Fields', 'odiseiaframework')}>
            {fields.map((field) => (
                <CptField
                    key={field.key}
                    field={field}
                    value={meta ? meta[field.key] : undefined}
                    onChange={(nextValue) => setMeta({ ...meta, [field.key]: nextValue })}
                />
            ))}
        </PluginDocumentSettingPanel>
    );
}

registerPlugin('odiseia-cpt-fields', { render: CptFieldsPanel });
