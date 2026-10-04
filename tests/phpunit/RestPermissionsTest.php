<?php

use odiseIAFramework\Cpt_Builder\Storage;

/**
 * Every CPT Builder REST route requires `manage_options`. Note: anonymous requests also get
 * 403 (not 401), since permissions_check() always returns a 403 WP_Error.
 */
class RestPermissionsTest extends Cpt_Builder_TestCase
{
    public function set_up()
    {
        parent::set_up();
        global $wp_rest_server;
        $wp_rest_server = new WP_REST_Server();
        do_action('rest_api_init', $wp_rest_server);
        self::save_definition('odiseia_book');
    }

    public function tear_down()
    {
        global $wp_rest_server;
        $wp_rest_server = null;
        parent::tear_down();
    }

    private function dispatch($method, $route)
    {
        return rest_get_server()->dispatch(new WP_REST_Request($method, '/odiseia-cpt-builder/v1' . $route));
    }

    /**
     * @dataProvider route_provider
     */
    public function test_anonymous_and_non_admin_users_are_forbidden($method, $route)
    {
        foreach ([0, self::factory()->user->create(['role' => 'editor'])] as $user_id) {
            wp_set_current_user($user_id);
            $response = $this->dispatch($method, $route);

            $this->assertSame(403, $response->get_status());
            $this->assertSame('odiseia_cpt_forbidden', $response->get_data()['code']);
        }
        $this->assertSame('publish', Storage::get('odiseia_book')['status']);
    }

    public function route_provider()
    {
        return [
            'list definitions' => ['GET', '/definitions'],
            'pause definition' => ['POST', '/definitions/odiseia_book/pause'],
            'trash definition' => ['POST', '/definitions/odiseia_book/trash'],
        ];
    }

    public function test_administrator_can_list_definitions()
    {
        wp_set_current_user(self::factory()->user->create(['role' => 'administrator']));
        $response = $this->dispatch('GET', '/definitions');

        $this->assertSame(200, $response->get_status());
        $this->assertSame(['odiseia_book'], wp_list_pluck($response->get_data(), 'slug'));
    }
}
