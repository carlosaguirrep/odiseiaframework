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
     * GET /definitions — active and paused definitions (trashed definitions are reached only by
     * slug, via get_item(), since they are pending permanent delete).
     *
     * @return \WP_REST_Response
     */
    public static function get_items()
    {
        return rest_ensure_response(array_values(array_map([self::class, 'format_entry'], Storage::all())));
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
