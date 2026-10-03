/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Thin wrapper around `apiFetch` for the `odiseia-cpt-builder/v1` REST routes (see
 * Rest_Controller). The namespace is read from `window.odiseiaCptBuilderSettings`
 * (set by Admin_Page::enqueue_assets()) instead of being hardcoded here, so PHP stays the single
 * source of truth for the route namespace.
 */
const { restNamespace = 'odiseia-cpt-builder/v1' } = window.odiseiaCptBuilderSettings || {};

/**
 * GET /definitions — active and paused definitions.
 *
 * @return {Promise<Array>}
 */
export function fetchDefinitions() {
    return apiFetch({ path: `/${restNamespace}/definitions` });
}

/**
 * POST /definitions — creates a definition.
 *
 * @param {Object} payload See payload.js's buildDefinitionPayload().
 * @return {Promise<Object>}
 */
export function createDefinition(payload) {
    return apiFetch({ path: `/${restNamespace}/definitions`, method: 'POST', data: payload });
}

/**
 * PUT /definitions/{slug} — updates an existing definition. The slug itself cannot change (see
 * Rest_Controller::update_item()): it is only ever read from the URL.
 *
 * @param {string} slug    Slug of the definition being updated.
 * @param {Object} payload See payload.js's buildDefinitionPayload().
 * @return {Promise<Object>}
 */
export function updateDefinition(slug, payload) {
    return apiFetch({ path: `/${restNamespace}/definitions/${slug}`, method: 'PUT', data: payload });
}

/**
 * POST /definitions/{slug}/pause — stops registering the CPT, keeps its posts untouched.
 *
 * @param {string} slug
 * @return {Promise<Object>}
 */
export function pauseDefinition(slug) {
    return apiFetch({ path: `/${restNamespace}/definitions/${slug}/pause`, method: 'POST' });
}

/**
 * POST /definitions/{slug}/resume — undoes pauseDefinition().
 *
 * @param {string} slug
 * @return {Promise<Object>}
 */
export function resumeDefinition(slug) {
    return apiFetch({ path: `/${restNamespace}/definitions/${slug}/resume`, method: 'POST' });
}

/**
 * GET /usage — content/trash post counts for every stored definition, keyed by slug.
 *
 * @return {Promise<Object<string, {content: number, trash: number}>>}
 */
export function fetchUsage() {
    return apiFetch({ path: `/${restNamespace}/usage` });
}

/**
 * POST /definitions/{slug}/trash — step 1 of the two-step delete. Batched server-side (see
 * Storage::trash()): call again while the response's `done` is false.
 *
 * @param {string} slug
 * @param {string} confirm Developer-typed slug; only checked server-side when content posts exist.
 * @return {Promise<{remaining: number, done: boolean}>}
 */
export function trashDefinition(slug, confirm) {
    return apiFetch({ path: `/${restNamespace}/definitions/${slug}/trash`, method: 'POST', data: { confirm } });
}

/**
 * POST /definitions/{slug}/restore — undoes trashDefinition(), back to paused. Batched
 * server-side, same as trashDefinition()/deleteDefinitionPermanently(): call again while the
 * response's `done` is false.
 *
 * @param {string} slug
 * @return {Promise<{remaining: number, done: boolean}>}
 */
export function restoreDefinition(slug) {
    return apiFetch({ path: `/${restNamespace}/definitions/${slug}/restore`, method: 'POST' });
}

/**
 * DELETE /definitions/{slug}?force=1&confirm=... — step 2 of the two-step delete, only valid
 * once trashDefinition() completed step 1. Batched server-side, same as trashDefinition().
 *
 * @param {string} slug
 * @param {string} confirm Developer-typed slug; only checked server-side when trashed posts exist.
 * @return {Promise<{remaining: number, done: boolean}>}
 */
export function deleteDefinitionPermanently(slug, confirm) {
    const query = new URLSearchParams({ force: '1', confirm: confirm || '' });

    return apiFetch({ path: `/${restNamespace}/definitions/${slug}?${query.toString()}`, method: 'DELETE' });
}
