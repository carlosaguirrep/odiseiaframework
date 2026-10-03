/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { pauseDefinition, resumeDefinition } from './api';
import DeleteDialog from './DeleteDialog';

/**
 * Pause/Resume/Delete controls for one definition row in DefinitionList. Pause/Resume only ever
 * change the definition's own lifecycle status (see Storage::pause()/resume()): content posts
 * are never touched. Delete opens DeleteDialog, which owns the two-step trash -> permanent-delete
 * flow (including the restore action once already trashed).
 *
 * @param {Object}   props
 * @param {Object}   props.entry     Entry from GET /definitions (slug, status, definition).
 * @param {Function} props.onChanged Called after any lifecycle action succeeds, so the parent
 *                                   list reloads.
 */
export default function LifecycleActions({ entry, onChanged }) {
    const [isBusy, setIsBusy] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [error, setError] = useState(null);

    const runAction = (action) => {
        setError(null);
        setIsBusy(true);
        action()
            .then(() => onChanged())
            .catch((err) =>
                setError(err?.message || __('The action could not be completed.', 'odiseiaframework'))
            )
            .finally(() => setIsBusy(false));
    };

    return (
        <div className="odiseia-cpt-builder-lifecycle">
            {'publish' === entry.status && (
                <Button
                    variant="tertiary"
                    disabled={isBusy}
                    onClick={() => runAction(() => pauseDefinition(entry.slug))}
                >
                    {__('Pause', 'odiseiaframework')}
                </Button>
            )}
            {'draft' === entry.status && (
                <Button
                    variant="tertiary"
                    disabled={isBusy}
                    onClick={() => runAction(() => resumeDefinition(entry.slug))}
                >
                    {__('Resume', 'odiseiaframework')}
                </Button>
            )}
            <Button isDestructive variant="tertiary" disabled={isBusy} onClick={() => setIsDeleteOpen(true)}>
                {'trash' === entry.status
                    ? __('Delete Permanently', 'odiseiaframework')
                    : __('Delete', 'odiseiaframework')}
            </Button>

            {error && <p className="odiseia-cpt-builder-lifecycle__error">{error}</p>}

            {isDeleteOpen && (
                <DeleteDialog
                    entry={entry}
                    onClose={() => setIsDeleteOpen(false)}
                    onChanged={onChanged}
                />
            )}
        </div>
    );
}
