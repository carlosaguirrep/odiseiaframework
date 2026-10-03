<?php

namespace odiseIAFramework\Cpt_Builder;

use WP_Error;
use WP_REST_Request;

/**
 * REST CRUD for CPT definitions, restricted to `manage_options`.
 *
 * Registered only while `\odiseIAFramework\Dev_Tools::is_visible()` is true (see
 * Cpt_Builder::init()): registration and rendering of already-saved definitions never depend on
 * this controller, so hiding dev tools cannot break existing content.
 */
class Rest_Controller
{
    const NAMESPACE_V1 = 'odiseia-cpt-builder/v1';

    /**
     * Registers the REST routes. Called from `rest_api_init` (see Cpt_Builder::init()).
     */
    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_V1, '/definitions', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_items'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_V1, '/definitions/(?P<slug>[a-z][a-z0-9_-]*)', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
            [
                'methods'             => 'PUT',
                'callback'            => [self::class, 'update_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
            [
                // Step 2 of the two-step delete, only valid once trash() completed step 1 (see
                // Storage::delete_permanently()). Query params only: `force=1` (explicit, so a
                // bare DELETE can never accidentally destroy data) and `confirm` (typed slug,
                // required when trashed content posts exist).
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_V1, '/definitions/(?P<slug>[a-z][a-z0-9_-]*)/pause', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'pause_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_V1, '/definitions/(?P<slug>[a-z][a-z0-9_-]*)/resume', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'resume_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_V1, '/definitions/(?P<slug>[a-z][a-z0-9_-]*)/trash', [
            [
                // Step 1 of the two-step delete. Body: {confirm}, required when content posts
                // exist. Batched (see Storage::trash()): call again while the response's
                // `done` is false.
                'methods'             => 'POST',
                'callback'            => [self::class, 'trash_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_V1, '/definitions/(?P<slug>[a-z][a-z0-9_-]*)/restore', [
            [
                // Undoes trash(). Batched (see Storage::restore()): call again while the
                // response's `done` is false.
                'methods'             => 'POST',
                'callback'            => [self::class, 'restore_item'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_V1, '/usage', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_usage'],
                'permission_callback' => [self::class, 'permissions_check'],
            ],
        ]);
    }

    /**
     * Every route requires `manage_options` (see Architecture Decisions: Capability).
     *
     * @return bool|WP_Error
     */
    public static function permissions_check()
    {
        if (current_user_can('manage_options')) {
            return true;
        }

        return new WP_Error(
            'odiseia_cpt_forbidden',
            __('You are not allowed to manage CPT definitions.', 'odiseiaframework'),
            ['status' => 403]
        );
    }

    /**
     * GET /definitions — every stored definition, including trashed ones (pending permanent
     * delete): the admin list is their only way back to Restore or step 2 of the delete flow.
     *
     * @return \WP_REST_Response
     */
    public static function get_items()
    {
        return rest_ensure_response(array_values(array_map([self::class, 'format_entry'], Storage::all(true))));
    }

    /**
     * GET /definitions/{slug}
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter.
     * @return \WP_REST_Response|WP_Error
     */
    public static function get_item(WP_REST_Request $request)
    {
        $entry = Storage::get(self::url_slug($request));
        if (null === $entry) {
            return self::not_found_error();
        }

        return rest_ensure_response(self::format_entry($entry));
    }

    /**
     * POST /definitions — creates a definition from the request body.
     *
     * @param WP_REST_Request $request Request with a JSON definition body.
     * @return \WP_REST_Response|WP_Error
     */
    public static function create_item(WP_REST_Request $request)
    {
        $definition = Definition::normalize((array) $request->get_json_params());
        $errors     = Definition::validate($definition);
        if (! empty($errors)) {
            return self::invalid_error($errors);
        }

        $post_id = Storage::save($definition);
        if (! $post_id) {
            return self::conflict_error();
        }

        $response = rest_ensure_response(self::format_entry([
            'post_id'    => $post_id,
            'status'     => 'publish',
            'definition' => $definition,
        ]));
        $response->set_status(201);

        return $response;
    }

    /**
     * PUT /definitions/{slug} — updates an existing definition. The slug is immutable (see
     * Architecture Decisions: Identifier): the URL slug always wins over the request body.
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter and a JSON body.
     * @return \WP_REST_Response|WP_Error
     */
    public static function update_item(WP_REST_Request $request)
    {
        $slug  = self::url_slug($request);
        $entry = Storage::get($slug);
        if (null === $entry) {
            return self::not_found_error();
        }

        $definition         = Definition::normalize((array) $request->get_json_params());
        $definition['slug'] = $slug;

        $errors = Definition::validate($definition, $slug);
        if (! empty($errors)) {
            return self::invalid_error($errors);
        }

        $post_id = Storage::save($definition, $entry['post_id']);
        if (! $post_id) {
            return self::conflict_error();
        }

        return rest_ensure_response(self::format_entry([
            'post_id'    => $post_id,
            'status'     => $entry['status'],
            'definition' => $definition,
        ]));
    }

    /**
     * POST /definitions/{slug}/pause
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter.
     * @return \WP_REST_Response|WP_Error
     */
    public static function pause_item(WP_REST_Request $request)
    {
        return self::lifecycle_response(Storage::pause(self::url_slug($request)));
    }

    /**
     * POST /definitions/{slug}/resume
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter.
     * @return \WP_REST_Response|WP_Error
     */
    public static function resume_item(WP_REST_Request $request)
    {
        return self::lifecycle_response(Storage::resume(self::url_slug($request)));
    }

    /**
     * POST /definitions/{slug}/trash — step 1 of the two-step delete.
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter and a JSON
     *                                 `{confirm}` body.
     * @return \WP_REST_Response|WP_Error
     */
    public static function trash_item(WP_REST_Request $request)
    {
        $confirm = (string) $request->get_param('confirm');

        return self::lifecycle_response(Storage::trash(self::url_slug($request), $confirm));
    }

    /**
     * POST /definitions/{slug}/restore — undoes trash(). Batched (see Storage::restore()): call
     * again while the response's `done` is false.
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter.
     * @return \WP_REST_Response|WP_Error
     */
    public static function restore_item(WP_REST_Request $request)
    {
        return self::lifecycle_response(Storage::restore(self::url_slug($request)));
    }

    /**
     * DELETE /definitions/{slug}?force=1&confirm=... — step 2 of the two-step delete. `force`
     * and `confirm` are read from the query string, not get_param(), for the same reason the
     * slug is read from get_url_params() (see url_slug()): a DELETE request has no JSON body to
     * shadow them, but being explicit keeps every route reading each parameter from one place.
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter.
     * @return \WP_REST_Response|WP_Error
     */
    public static function delete_item(WP_REST_Request $request)
    {
        $query = $request->get_query_params();

        if (empty($query['force'])) {
            return new WP_Error(
                'odiseia_cpt_force_required',
                __('Pass force=1 to permanently delete.', 'odiseiaframework'),
                ['status' => 400]
            );
        }

        $confirm = isset($query['confirm']) ? (string) $query['confirm'] : '';

        return self::lifecycle_response(Storage::delete_permanently(self::url_slug($request), $confirm));
    }

    /**
     * GET /usage — content-post counts per stored definition, for the list view and the delete
     * confirmation dialog.
     *
     * @return \WP_REST_Response
     */
    public static function get_usage()
    {
        return rest_ensure_response(Storage::usage_all());
    }

    /**
     * Converts a Storage lifecycle result (see Storage::pause() and friends) into a REST
     * response, so each handler above stays a one-liner.
     *
     * @param array{ok: bool, code?: string, remaining?: int, done?: bool} $result
     * @return \WP_REST_Response|WP_Error
     */
    private static function lifecycle_response(array $result)
    {
        if (empty($result['ok'])) {
            return self::lifecycle_error(isset($result['code']) ? $result['code'] : '');
        }

        unset($result['ok']);

        return rest_ensure_response(empty($result) ? ['ok' => true] : $result);
    }

    /**
     * @param string $code One of Storage's lifecycle error codes.
     * @return WP_Error
     */
    private static function lifecycle_error($code)
    {
        $errors = [
            'not_found'        => ['odiseia_cpt_not_found', __('Definition not found.', 'odiseiaframework'), 404],
            'invalid_state'    => ['odiseia_cpt_invalid_state', __('This action is not allowed in the current state.', 'odiseiaframework'), 409],
            'already_trashed'  => ['odiseia_cpt_invalid_state', __('This definition is already trashed.', 'odiseiaframework'), 409],
            'trash_disabled'   => ['odiseia_cpt_trash_disabled', __('The trash is disabled on this site; permanent delete only.', 'odiseiaframework'), 409],
            'confirm_mismatch' => ['odiseia_cpt_confirm_mismatch', __('Type the slug exactly to confirm.', 'odiseiaframework'), 400],
            'collision'        => ['odiseia_cpt_collision', __('This post type is managed by another plugin or theme; this action cannot continue.', 'odiseiaframework'), 409],
            'stuck'            => ['odiseia_cpt_stuck', __('One or more posts could not be processed. Check for something blocking deletion and try again.', 'odiseiaframework'), 409],
        ];

        [$wp_code, $message, $status] = isset($errors[$code])
            ? $errors[$code]
            : ['odiseia_cpt_error', __('Could not complete the action.', 'odiseiaframework'), 400];

        $data = ['status' => $status];
        if ('confirm_mismatch' === $code) {
            $data['errors'] = [['path' => 'confirm', 'code' => 'mismatch']];
        } elseif (in_array($code, ['collision', 'stuck'], true)) {
            $data['errors'] = [['path' => 'slug', 'code' => $code]];
        }

        return new WP_Error($wp_code, $message, $data);
    }

    /**
     * The `slug` URL parameter, read from the route match only.
     *
     * `WP_REST_Request::get_param()`/`offsetGet()` merge every parameter source with the JSON
     * body winning over the URL (see WP_REST_Request::get_parameter_order()), so a request body
     * that happens to contain a `slug` key would silently shadow the route's slug. The slug is
     * immutable and identifies the resource being addressed, so it must only ever come from the
     * URL itself.
     *
     * @param WP_REST_Request $request Request with a `slug` URL parameter.
     * @return string
     */
    private static function url_slug(WP_REST_Request $request)
    {
        $url_params = $request->get_url_params();

        return isset($url_params['slug']) ? (string) $url_params['slug'] : '';
    }

    /**
     * Response shape shared by every route: the storage entry plus its slug at the top level.
     *
     * @param array{post_id: int, status: string, definition: array} $entry Storage entry.
     * @return array
     */
    private static function format_entry(array $entry)
    {
        return [
            'post_id'    => $entry['post_id'],
            'slug'       => $entry['definition']['slug'],
            'status'     => $entry['status'],
            'definition' => $entry['definition'],
        ];
    }

    /** @return WP_Error 404 "definition not found" error. */
    private static function not_found_error()
    {
        return new WP_Error(
            'odiseia_cpt_not_found',
            __('Definition not found.', 'odiseiaframework'),
            ['status' => 404]
        );
    }

    /**
     * @param array<int, array{path: string, code: string}> $errors Field-level errors from
     *                                                                Definition::validate().
     * @return WP_Error 400 error carrying the field-level errors for inline display.
     */
    private static function invalid_error(array $errors)
    {
        return new WP_Error(
            'odiseia_cpt_invalid',
            __('The definition is invalid.', 'odiseiaframework'),
            ['status' => 400, 'errors' => $errors]
        );
    }

    /** @return WP_Error 409 "slug already used by another definition" error. */
    private static function conflict_error()
    {
        return new WP_Error(
            'odiseia_cpt_conflict',
            __('This slug is already used by another definition.', 'odiseiaframework'),
            ['status' => 409]
        );
    }
}
