/**
 * WordPress dependencies
 */
import { Button, Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import LifecycleActions from './LifecycleActions';

/**
 * Lists every stored CPT definition (label, slug, status, field count) with a button to create a
 * new one, one to edit each existing row, and pause/resume/delete controls (LifecycleActions).
 * Trashed definitions (pending permanent delete) are included too, so their row is the only way
 * back to Restore or step 2 of the delete flow.
 *
 * @param {Object}   props
 * @param {Array}    props.definitions Entries from GET /definitions (see Rest_Controller).
 * @param {boolean}  props.isLoading   Whether the initial fetch is still in flight.
 * @param {Function} props.onCreate    Called when "Add New" is pressed.
 * @param {Function} props.onEdit      Called with a definition entry when "Edit" is pressed.
 * @param {Function} props.onChanged   Called after a lifecycle action succeeds, to reload the list.
 */
export default function DefinitionList({ definitions, isLoading, onCreate, onEdit, onChanged }) {
    return (
        <div className="odiseia-cpt-builder-list">
            <div className="odiseia-cpt-builder-list__header">
                <h1>{__('CPT Builder', 'odiseiaframework')}</h1>
                <Button variant="primary" onClick={onCreate}>
                    {__('Add New', 'odiseiaframework')}
                </Button>
            </div>

            {isLoading && <Spinner />}

            {!isLoading && 0 === definitions.length && (
                <p>{__('No custom post types yet. Add your first one.', 'odiseiaframework')}</p>
            )}

            {!isLoading && definitions.length > 0 && (
                <table className="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th>{__('Label', 'odiseiaframework')}</th>
                            <th>{__('Slug', 'odiseiaframework')}</th>
                            <th>{__('Status', 'odiseiaframework')}</th>
                            <th>{__('Fields', 'odiseiaframework')}</th>
                            <th aria-label={__('Actions', 'odiseiaframework')} />
                        </tr>
                    </thead>
                    <tbody>
                        {definitions.map((entry) => (
                            <tr key={entry.slug}>
                                <td>{entry.definition.labels.plural || entry.definition.labels.singular}</td>
                                <td>
                                    <code>{entry.slug}</code>
                                </td>
                                <td>{statusLabel(entry.status)}</td>
                                <td>{entry.definition.fields.length}</td>
                                <td>
                                    <Button variant="secondary" onClick={() => onEdit(entry)}>
                                        {__('Edit', 'odiseiaframework')}
                                    </Button>
                                    <LifecycleActions entry={entry} onChanged={onChanged} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

/**
 * Human-readable label for a definition's `post_status` (publish = active, draft = paused).
 *
 * @param {string} status Raw `post_status`.
 * @return {string}
 */
function statusLabel(status) {
    if ('publish' === status) {
        return __('Active', 'odiseiaframework');
    }
    if ('draft' === status) {
        return __('Paused', 'odiseiaframework');
    }

    return sprintf(
        /* translators: %s: raw post status, shown when it is neither "publish" nor "draft". */
        __('Unknown (%s)', 'odiseiaframework'),
        status
    );
}
