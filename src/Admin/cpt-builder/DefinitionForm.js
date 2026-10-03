/**
 * WordPress dependencies
 */
import { Button, CheckboxControl, Notice, TextControl } from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { createDefinition, updateDefinition } from './api';
import { ALLOWED_TAXONOMIES } from './validation';
import { mapServerErrors } from './error-map';
import FieldsEditor, { createEmptyField } from './FieldsEditor';
import { validateFormState } from './form-validation';
import { buildDefinitionPayload } from './payload';

const TAXONOMY_LABELS = {
    category: __('Category', 'odiseiaframework'),
    post_tag: __('Tags', 'odiseiaframework'),
};

const { reservedSlugs = [] } = window.odiseiaCptBuilderSettings || {};

/**
 * Builds the initial form state from an existing entry (edit) or blank (create).
 *
 * @param {Object|null} entry Entry from GET /definitions, or null when creating.
 * @return {Object} Form state (see payload.js's buildDefinitionPayload() for the shape).
 */
function initialFormState(entry) {
    const definition = entry ? entry.definition : null;

    return {
        slug: definition ? definition.slug : '',
        singularLabel: definition ? definition.labels.singular : '',
        pluralLabel: definition ? definition.labels.plural : '',
        taxonomies: ALLOWED_TAXONOMIES.reduce((map, taxonomy) => {
            map[taxonomy] = Boolean(definition && definition.taxonomies.includes(taxonomy));
            return map;
        }, {}),
        fields:
            definition && definition.fields.length > 0
                ? definition.fields.map((field) => ({ ...createEmptyField(), ...field }))
                : [],
    };
}

/**
 * Create/edit form for one CPT definition. The slug is immutable once created (see
 * Architecture Decisions: Identifier in the design): the field is disabled when editing.
 *
 * @param {Object}      props
 * @param {Object|null} props.entry         Entry being edited, or null to create a new one.
 * @param {string[]}    props.existingSlugs Slugs of every other stored definition (for the
 *                                          client-side conflict check — PHP re-checks on save).
 * @param {Function}    props.onCancel      Called when the form is dismissed without saving.
 * @param {Function}    props.onSaved       Called after a successful create/update.
 */
export default function DefinitionForm({ entry, existingSlugs, onCancel, onSaved }) {
    const isEditing = Boolean(entry);
    const [formState, setFormState] = useState(() => initialFormState(entry));
    const [errors, setErrors] = useState({});
    const [topLevelError, setTopLevelError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    // A ref (not state) guards against a second submit fired before React re-renders with
    // isSaving === true (e.g. a fast double click/Enter).
    const isSavingRef = useRef(false);

    const updateFormState = (changes) => {
        setFormState((current) => ({ ...current, ...changes }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (isSavingRef.current) {
            return;
        }

        setTopLevelError(null);

        const validationErrors = validateFormState(formState, {
            reservedSlugs,
            existingSlugs,
            currentSlug: isEditing ? entry.slug : null,
        });

        if (validationErrors.length > 0) {
            setErrors(mapServerErrors(validationErrors));
            return;
        }

        setErrors({});
        isSavingRef.current = true;
        setIsSaving(true);

        const payload = buildDefinitionPayload(formState, isEditing ? entry.definition : undefined);
        const request = isEditing ? updateDefinition(entry.slug, payload) : createDefinition(payload);

        request
            .then(() => {
                onSaved();
            })
            .catch((error) => {
                setErrors(mapServerErrors(error?.data?.errors));
                setTopLevelError(
                    error?.message || __('The definition could not be saved.', 'odiseiaframework')
                );
            })
            .finally(() => {
                isSavingRef.current = false;
                setIsSaving(false);
            });
    };

    return (
        <form className="odiseia-cpt-builder-form" onSubmit={handleSubmit}>
            <h1>
                {isEditing
                    ? __('Edit Post Type', 'odiseiaframework')
                    : __('Add New Post Type', 'odiseiaframework')}
            </h1>

            {topLevelError && (
                <Notice status="error" onRemove={() => setTopLevelError(null)}>
                    {topLevelError}
                </Notice>
            )}

            <TextControl
                label={__('Slug', 'odiseiaframework')}
                value={formState.slug}
                disabled={isEditing}
                help={errors.slug || __('Lowercase letters, numbers, underscores, and hyphens only. Cannot be changed later.', 'odiseiaframework')}
                onChange={(slug) => updateFormState({ slug })}
            />
            <TextControl
                label={__('Singular Label', 'odiseiaframework')}
                value={formState.singularLabel}
                help={errors['labels.singular']}
                onChange={(singularLabel) => updateFormState({ singularLabel })}
            />
            <TextControl
                label={__('Plural Label', 'odiseiaframework')}
                value={formState.pluralLabel}
                help={errors['labels.plural']}
                onChange={(pluralLabel) => updateFormState({ pluralLabel })}
            />

            <fieldset>
                <legend>{__('Taxonomies', 'odiseiaframework')}</legend>
                {errors.taxonomies && (
                    <p className="components-base-control__help odiseia-cpt-builder-form__error">
                        {errors.taxonomies}
                    </p>
                )}
                {ALLOWED_TAXONOMIES.map((taxonomy) => (
                    <CheckboxControl
                        key={taxonomy}
                        label={TAXONOMY_LABELS[taxonomy] || taxonomy}
                        checked={Boolean(formState.taxonomies[taxonomy])}
                        onChange={(checked) =>
                            updateFormState({
                                taxonomies: { ...formState.taxonomies, [taxonomy]: checked },
                            })
                        }
                    />
                ))}
            </fieldset>

            <FieldsEditor
                fields={formState.fields}
                errors={errors}
                onChange={(fields) => updateFormState({ fields })}
            />

            <div className="odiseia-cpt-builder-form__actions">
                <Button variant="primary" type="submit" isBusy={isSaving} disabled={isSaving}>
                    {__('Save', 'odiseiaframework')}
                </Button>
                <Button variant="tertiary" onClick={onCancel} disabled={isSaving}>
                    {__('Cancel', 'odiseiaframework')}
                </Button>
            </div>
        </form>
    );
}
