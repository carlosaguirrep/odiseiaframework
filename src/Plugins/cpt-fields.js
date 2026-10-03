/**
 * WordPress dependencies
 */
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { registerBlockBindingsSource } from '@wordpress/blocks';
import { Button, PanelRow, TextControl } from '@wordpress/components';
import { store as coreStore, useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { PluginDocumentSettingPanel, store as editorStore } from '@wordpress/editor';
import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import { CONTROL_TYPES, getControlType, toControlValue, toMetaValue } from './cpt-fields/controls';

const PANEL_NAME = 'odiseia-cpt-fields';
const BINDING_SOURCE_NAME = 'odiseia/attachment';

// Localized by Cpt_Builder::enqueue_fields_panel_assets(): one entry per active CPT slug, each an
// array of `{key, label, type}` (see Definition schema) — the same source of truth the Query
// Loop variation and the registrar use, so this panel can never list a field the CPT does not
// actually have.
const SETTINGS = window.odiseiaCptFieldsSettings || {};
const FIELDS_BY_POST_TYPE = SETTINGS.fields && 'object' === typeof SETTINGS.fields ? SETTINGS.fields : {};

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
            </PanelRow>
        );
    }

    const inputType =
        CONTROL_TYPES.NUMBER === controlType
            ? 'number'
            : CONTROL_TYPES.DATE === controlType
              ? 'date'
              : CONTROL_TYPES.URL === controlType
                ? 'url'
                : 'text';

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

/**
 * Client-side counterpart of Image_Binding::register_source() (PHP): lets the EDITOR preview an
 * image field's bound `url`/`alt` while editing a Query Loop template, instead of showing the
 * static placeholder until the page is saved and reloaded. Read-only (`canUserEditValue: false`
 * — editing happens through the "CPT Fields" panel above, or the image field's own meta, not
 * inline on the bound attribute), and intentionally silent (returns {}) whenever the attachment
 * or its media record is not yet available, so a transient resolver miss never throws.
 */
registerBlockBindingsSource({
    name: BINDING_SOURCE_NAME,
    usesContext: ['postId', 'postType'],
    canUserEditValue: () => false,
    getValues({ select, context, bindings }) {
        const values = {};
        const { postId, postType } = context || {};
        if (!postId || !postType) {
            return values;
        }

        const record = select(coreStore).getEntityRecord('postType', postType, postId);
        const meta = record && record.meta ? record.meta : {};

        Object.entries(bindings).forEach(([attributeName, binding]) => {
            const key = binding && binding.args ? binding.args.key : undefined;
            const attachmentId = key ? parseInt(meta[key], 10) : 0;
            if (!attachmentId) {
                return;
            }

            const media = select(coreStore).getMedia(attachmentId);
            if (!media) {
                return;
            }

            if ('url' === attributeName) {
                values.url = media.source_url;
            } else if ('alt' === attributeName) {
                values.alt = media.alt_text;
            }
        });

        return values;
    },
});
