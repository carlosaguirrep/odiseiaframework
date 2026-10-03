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
