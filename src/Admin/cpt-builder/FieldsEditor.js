/**
 * WordPress dependencies
 */
import { Button, SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getFieldTypeOptions } from './field-types';

let nextRowId = 0;

/**
 * Creates an empty field row with a stable UI-only id (used as the React list key and stripped
 * before the form state reaches the REST API — see payload.js's buildDefinitionPayload()).
 *
 * @return {{id: string, key: string, label: string, type: string}}
 */
export function createEmptyField() {
    nextRowId += 1;

    return { id: `field-${nextRowId}`, key: '', label: '', type: 'text' };
}

/**
 * Repeater for a definition's fields (key/label/type), limited to the types the registrar
 * supports (see field-types.js, mirroring Definition::FIELD_TYPES).
 *
 * @param {Object}   props
 * @param {Array}    props.fields  Current field rows (see createEmptyField()).
 * @param {Object}   props.errors  `{ path: message }` map from error-map.js, keyed by
 *                                 `fields.{index}.{key|label|type}` for row errors, and `fields`
 *                                 itself for a definition-level error (e.g. too many fields).
 * @param {Function} props.onChange Called with the updated fields array on every edit.
 */
export default function FieldsEditor({ fields, errors, onChange }) {
    const typeOptions = getFieldTypeOptions();

    const updateField = (index, changes) => {
        onChange(fields.map((field, i) => (i === index ? { ...field, ...changes } : field)));
    };

    const removeField = (index) => {
        onChange(fields.filter((_field, i) => i !== index));
    };

    const addField = () => {
        onChange([...fields, createEmptyField()]);
    };

    return (
        <div className="odiseia-cpt-builder-fields">
            <h2>{__('Fields', 'odiseiaframework')}</h2>

            {errors.fields && (
                <p className="components-base-control__help odiseia-cpt-builder-form__error">
                    {errors.fields}
                </p>
            )}

            {fields.map((field, index) => (
                <div className="odiseia-cpt-builder-fields__row" key={field.id}>
                    <TextControl
                        label={__('Key', 'odiseiaframework')}
                        value={field.key}
                        onChange={(key) => updateField(index, { key })}
                        help={errors[`fields.${index}.key`]}
                    />
                    <TextControl
                        label={__('Label', 'odiseiaframework')}
                        value={field.label}
                        onChange={(label) => updateField(index, { label })}
                        help={errors[`fields.${index}.label`]}
                    />
                    <SelectControl
                        label={__('Type', 'odiseiaframework')}
                        value={field.type}
                        options={typeOptions}
                        onChange={(type) => updateField(index, { type })}
                        help={errors[`fields.${index}.type`]}
                    />
                    <Button
                        variant="tertiary"
                        isDestructive
                        onClick={() => removeField(index)}
                        aria-label={__('Remove field', 'odiseiaframework')}
                    >
                        {__('Remove', 'odiseiaframework')}
                    </Button>
                </div>
            ))}

            <Button variant="secondary" onClick={addField}>
                {__('Add Field', 'odiseiaframework')}
            </Button>
        </div>
    );
}
