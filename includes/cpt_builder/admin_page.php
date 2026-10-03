<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * CPT Builder admin page: a submenu of the main OdiseIa options page (see Odiseia_Options).
 *
 * Registered only while `\odiseIAFramework\Dev_Tools::is_visible()` is true (see
 * Cpt_Builder::init()): existing CPTs keep registering and rendering regardless.
 */
class Admin_Page
{
    const PAGE_SLUG = 'odiseia-cpt-builder';

    const BUNDLE_HANDLE = 'odiseiaframework-cpt-builder';

    /** Entry path inside `build/`, without extension. Built from src/Admin/cpt-builder.js. */
    const BUNDLE_ENTRY = 'Admin/cpt-builder';

    /**
     * Hook suffix returned by add_submenu_page(), used by enqueue_assets() to load the bundle
     * only on this page. Reading the exact hook string back avoids guessing the format WordPress
     * derives from the parent and menu slugs (see get_plugin_page_hookname()).
     *
     * @var string|false
     */
    private static $hook_suffix = false;

    public static function init()
    {
        add_action('admin_menu', [self::class, 'register_menu']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
    }

    public static function register_menu()
    {
        self::$hook_suffix = add_submenu_page(
            'odiseiaframework',
            __('CPT Builder', 'odiseiaframework'),
            __('CPT Builder', 'odiseiaframework'),
            'manage_options',
            self::PAGE_SLUG,
            [self::class, 'render_page']
        );
    }

    /**
     * Renders the mount point for the React admin app built from src/Admin/cpt-builder.js.
     */
    public static function render_page()
    {
        echo '<div id="odiseia-cpt-builder-root" class="wrap"></div>';
    }

    /**
     * @param string $hook Current admin page's hook suffix, passed by `admin_enqueue_scripts`.
     */
    public static function enqueue_assets($hook)
    {
        if (empty(self::$hook_suffix) || $hook !== self::$hook_suffix) {
            return;
        }

        // No-op until the bundle exists (build/Admin/cpt-builder.asset.php, added once
        // src/Admin/cpt-builder.js is built), same guard as Assets::enqueue_plugin_script().
        if (! \odiseIAFramework\Assets::enqueue_build_script(self::BUNDLE_HANDLE, self::BUNDLE_ENTRY)) {
            return;
        }

        // PHP stays the single source of truth for format rules; the browser only mirrors them
        // for instant feedback (see Definition::reserved_slugs_for_js()).
        wp_add_inline_script(
            self::BUNDLE_HANDLE,
            'window.odiseiaCptBuilderSettings = ' . wp_json_encode([
                'restNamespace' => Rest_Controller::NAMESPACE_V1,
                'reservedSlugs' => Definition::reserved_slugs_for_js(),
            ]) . ';',
            'before'
        );

        wp_set_script_translations(self::BUNDLE_HANDLE, 'odiseiaframework');
    }
}
