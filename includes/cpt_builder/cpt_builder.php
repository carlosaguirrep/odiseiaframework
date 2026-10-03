<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * Boots the CPT Builder module: storage post type, registrar, and rewrite flush handling.
 *
 * Admin management UI (REST routes, admin page) is added in a later slice and gated behind
 * `\odiseIAFramework\Dev_Tools::is_visible()`. Registration itself is never gated: existing CPTs
 * must keep serving content even when dev tools are hidden.
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
