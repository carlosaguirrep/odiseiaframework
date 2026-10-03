<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * Boots the CPT Builder module: storage post type, registrar, rewrite flush handling, and the
 * dev-tools-gated management UI (REST routes, admin page).
 *
 * Registration itself is never gated: existing CPTs must keep serving content even when dev
 * tools are hidden, so only the management UI below checks `Dev_Tools::is_visible()`.
 */
class Cpt_Builder
{
    /**
     * Runs on `init` (see odiseiaframework_init()), after default taxonomies (priority 0).
     */
    public static function init()
    {
        Storage::register_post_type();
        Registrar::register_all();

        add_action('wp_loaded', [self::class, 'maybe_flush_rewrite_rules']);
        add_action('admin_notices', [Registrar::class, 'render_collision_notice']);
        // Not gated by Dev_Tools::is_visible(): a lifecycle-trashed post must stay protected from
        // wp_scheduled_delete regardless of whether the management UI is shown.
        add_filter('pre_delete_post', [Storage::class, 'guard_scheduled_delete'], 10, 3);

        if (\odiseIAFramework\Dev_Tools::is_visible()) {
            add_action('rest_api_init', [Rest_Controller::class, 'register_routes']);
            Admin_Page::init();
        }
    }

    /**
     * Flushes rewrite rules once after a definition changed, so the new CPT's archive/singular
     * URLs start working. Runs on `wp_loaded`, after every `init` callback had a chance to
     * register post types: flushing during the save request itself would miss the very type
     * being saved, since it is not registered until the next request.
     */
    public static function maybe_flush_rewrite_rules()
    {
        if (! get_option(Storage::FLUSH_OPTION)) {
            return;
        }

        delete_option(Storage::FLUSH_OPTION);
        flush_rewrite_rules(false);
    }
}
