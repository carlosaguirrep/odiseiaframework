/**
 * Pure "type the slug to confirm" logic shared by LifecycleActions/DeleteDialog's two
 * irreversible steps (trash and permanent delete). Mirrors the REST API's own check exactly
 * (see Storage::trash()/delete_permanently() in includes/cpt_builder/storage.php: a confirm is
 * only required when the CPT has posts at stake, and the comparison is a strict `===`), so the
 * confirm button only ever enables once the server would actually accept the input.
 */

/**
 * Whether a confirm-by-typing-name step is required at all.
 *
 * @param {number} postCount Number of posts at stake for this step (content posts for trash,
 *                            trashed posts for permanent delete — see Storage::usage()).
 * @return {boolean}
 */
export function isConfirmRequired(postCount) {
    return Number(postCount) > 0;
}

/**
 * Whether the developer's typed input would satisfy the confirm requirement.
 *
 * @param {string} input     Developer-typed text.
 * @param {string} slug      The CPT slug being confirmed.
 * @param {number} postCount Number of posts at stake for this step.
 * @return {boolean}
 */
export function isConfirmSatisfied(input, slug, postCount) {
    if (!isConfirmRequired(postCount)) {
        return true;
    }

    return input === slug;
}
