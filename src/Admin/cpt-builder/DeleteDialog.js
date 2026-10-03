/**
 * WordPress dependencies
 */
import { Button, Modal, Notice, TextControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { deleteDefinitionPermanently, fetchUsage, restoreDefinition, trashDefinition } from './api';
import { isConfirmRequired, isConfirmSatisfied } from './confirm';
import { mapServerErrors } from './error-map';

/**
 * Two-step delete dialog, opened from LifecycleActions. Step 1 trashes the CPT's own content
 * posts and then the definition itself (Storage::trash()). Step 2 (only reachable once already
 * trashed) permanently removes the trashed content posts and the definition
 * (Storage::delete_permanently()) — irreversible.
 *
 * GET /definitions now returns trashed definitions too (see Rest_Controller::get_items()), and
 * DefinitionList renders them in their own "Trash" section, so `onChanged` is called as soon as
 * each step finishes (including step 1) to keep that section in sync. This dialog still stays
 * open and tracks its own `status` across both steps instead of closing after step 1 — Restore
 * (Storage::restore()) is offered right here as the escape hatch before committing to step 2 —
 * and only closes itself once step 2 (or Restore) actually completes.
 *
 * Every lifecycle step (trash, restore, permanent delete) is batched server-side: a large CPT
 * may need more than one request per click, so this component keeps calling the same action
 * while the response's `done` is false, showing how many posts are left in between.
 *
 * @param {Object}   props
 * @param {Object}   props.entry     Entry being deleted (slug, status).
 * @param {Function} props.onClose   Called to dismiss the dialog without further action.
 * @param {Function} props.onChanged Called once a lifecycle action succeeded, so the parent list
 *                                   reloads (the dialog itself decides when to also close).
 */
export default function DeleteDialog({ entry, onClose, onChanged }) {
    const [status, setStatus] = useState(entry.status);
    const isTrashed = 'trash' === status;
    const [usage, setUsage] = useState(null);
    const [confirmText, setConfirmText] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [remaining, setRemaining] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsage()
            .then((all) => setUsage((all && all[entry.slug]) || { content: 0, trash: 0 }))
            .catch(() => setUsage({ content: 0, trash: 0 }));
        // Re-fetch whenever the dialog's own status changes (after step 1 completes), since the
        // content/trash split flips from under it.
    }, [entry.slug, status]);

    if (null === usage) {
        return null;
    }

    const postCount = isTrashed ? usage.trash : usage.content;
    const confirmRequired = isConfirmRequired(postCount);
    const confirmOk = isConfirmSatisfied(confirmText, entry.slug, postCount);

    const handleError = (err) => {
        const mapped = mapServerErrors(err?.data?.errors).slug;
        setError(mapped || err?.message || __('The action could not be completed.', 'odiseiaframework'));
    };

    const runTrashStep = () => {
        setError(null);
        setIsBusy(true);

        const step = () =>
            trashDefinition(entry.slug, confirmText)
                .then((result) => {
                    if (result.done) {
                        setRemaining(null);
                        setConfirmText('');
                        setStatus('trash');
                        onChanged();
                        return;
                    }
                    setRemaining(result.remaining);
                    return step();
                })
                .catch(handleError)
                .finally(() => setIsBusy(false));

        return step();
    };

    const runDeleteStep = () => {
        setError(null);
        setIsBusy(true);

        const step = () =>
            deleteDefinitionPermanently(entry.slug, confirmText)
                .then((result) => {
                    if (result.done) {
                        onChanged();
                        onClose();
                        return;
                    }
                    setRemaining(result.remaining);
                    return step();
                })
                .catch(handleError)
                .finally(() => setIsBusy(false));

        return step();
    };

    const handleRestore = () => {
        setError(null);
        setIsBusy(true);

        const step = () =>
            restoreDefinition(entry.slug)
                .then((result) => {
                    if (result.done) {
                        setRemaining(null);
                        onChanged();
                        onClose();
                        return;
                    }
                    setRemaining(result.remaining);
                    return step();
                })
                .catch(handleError)
                .finally(() => setIsBusy(false));

        return step();
    };

    return (
        <Modal
            title={isTrashed ? __('Permanently Delete', 'odiseiaframework') : __('Move to Trash', 'odiseiaframework')}
            onRequestClose={() => {
                if (!isBusy) {
                    onClose();
                }
            }}
            isDismissible={!isBusy}
            shouldCloseOnEsc={!isBusy}
            shouldCloseOnClickOutside={!isBusy}
        >
            {error && (
                <Notice status="error" onRemove={() => setError(null)}>
                    {error}
                </Notice>
            )}

            {!isTrashed && (
                <p>
                    {postCount > 0
                        ? sprintf(
                              /* translators: %d: number of posts that will be moved to trash. */
                              __(
                                  'This will move %d post(s) of this type to the trash. This is step 1 of 2 — permanent delete comes next.',
                                  'odiseiaframework'
                              ),
                              postCount
                          )
                        : __('This CPT has no posts. It will move to the trash immediately.', 'odiseiaframework')}
                </p>
            )}

            {isTrashed && (
                <p>
                    {postCount > 0
                        ? sprintf(
                              /* translators: %d: number of trashed posts that will be permanently removed. */
                              __(
                                  'This will permanently remove %d trashed post(s) and this CPT definition. This cannot be undone.',
                                  'odiseiaframework'
                              ),
                              postCount
                          )
                        : __(
                              'This will permanently remove this CPT definition. This cannot be undone.',
                              'odiseiaframework'
                          )}
                </p>
            )}

            {confirmRequired && (
                <TextControl
                    label={sprintf(
                        /* translators: %s: CPT slug the developer must type to confirm. */
                        __('Type "%s" to confirm', 'odiseiaframework'),
                        entry.slug
                    )}
                    value={confirmText}
                    onChange={setConfirmText}
                />
            )}

            {null !== remaining && (
                <p>
                    {sprintf(
                        /* translators: %d: number of posts still left to process. */
                        __('Working… %d post(s) left.', 'odiseiaframework'),
                        remaining
                    )}
                </p>
            )}

            <div className="odiseia-cpt-builder-delete-dialog__actions">
                {isTrashed && (
                    <Button variant="secondary" disabled={isBusy} onClick={handleRestore}>
                        {__('Restore', 'odiseiaframework')}
                    </Button>
                )}
                <Button
                    isDestructive
                    variant="primary"
                    isBusy={isBusy}
                    disabled={isBusy || !confirmOk}
                    onClick={isTrashed ? runDeleteStep : runTrashStep}
                >
                    {isTrashed ? __('Permanently Delete', 'odiseiaframework') : __('Move to Trash', 'odiseiaframework')}
                </Button>
                <Button variant="tertiary" disabled={isBusy} onClick={onClose}>
                    {__('Cancel', 'odiseiaframework')}
                </Button>
            </div>
        </Modal>
    );
}
