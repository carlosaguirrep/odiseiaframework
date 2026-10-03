<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * Boots the CPT Builder module: storage post type, registrar, Query Loop variations, block
 * bindings, rewrite flush handling, and the dev-tools-gated management UI (REST routes, admin
 * page).
 *
 * Registration, the Query Loop variation, and block bindings are never gated: existing CPTs and
 * content relying on them must keep serving/rendering correctly even when dev tools are hidden,
 * so only the management UI below checks `Dev_Tools::is_visible()`.
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
        Variations::init();
        Image_Binding::register_source();

        add_action('wp_loaded', [self::class, 'maybe_flush_rewrite_rules']);
        add_action('admin_notices', [Registrar::class, 'render_collision_notice']);
        // Not gated by Dev_Tools::is_visible(): a lifecycle-trashed post must stay protected from
        // wp_scheduled_delete regardless of whether the management UI is shown.
        add_filter('pre_delete_post', [Storage::class, 'guard_scheduled_delete'], 10, 3);
        // Editing a CPT post's own fields is a content-editing concern, not part of the CPT
        // Builder management UI, so it is never gated by Dev_Tools::is_visible() either.
        add_action('enqueue_block_editor_assets', [self::class, 'enqueue_fields_panel_assets']);

        if (\odiseIAFramework\Dev_Tools::is_visible()) {
            add_action('rest_api_init', [Rest_Controller::class, 'register_routes']);
            Admin_Page::init();
        }
    }

    /**
     * Enqueues the "CPT Fields" editor panel (src/Plugins/cpt-fields.js) and localizes the
     * CURRENT screen's own CPT field schema, so the panel can render the right control per field
     * without any extra REST round-trip — the editor already loads the CURRENT post's own meta
     * values via core-data, since every field's meta is registered with `show_in_rest => true`
     * (see Registrar::register_one()). Only field metadata (key/label/type) is localized here,
     * never meta VALUES: those stay gated by core's own per-post `read_post`/`edit_post` checks.
     *
     * Gated by `get_current_screen()->post_type` (set for every post.php/post-new.php screen —
     * see WP_Screen::get()) instead of localizing every active CPT's fields on every editor
     * screen: this callback used to run (and enqueue the script, and localize every CPT) on
     * every single post/page/CPT edit screen site-wide, not just the ones that are actually one
     * of our active CPTs, which is both needless asset weight and an unbounded localized payload
     * as more CPTs are defined.
     */
    public static function enqueue_fields_panel_assets()
    {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        $post_type = $screen ? $screen->post_type : '';
        if (empty($post_type)) {
            return;
        }

        $entry = Storage::all()[$post_type] ?? null;
        if (null === $entry || 'publish' !== $entry['status'] || empty($entry['definition']['fields'])) {
            return; // Not one of our active CPTs, or it has no fields to edit.
        }

        $fields = array_map(static function ($field) {
            return ['key' => $field['key'], 'label' => $field['label'], 'type' => $field['type']];
        }, $entry['definition']['fields']);

        if (\odiseIAFramework\Assets::enqueue_plugin_script('odiseiaframework-cpt-fields', 'cpt-fields')) {
            wp_add_inline_script(
                'odiseiaframework-cpt-fields',
                'window.odiseiaCptFieldsSettings = ' . wp_json_encode(['fields' => [$post_type => $fields]]) . ';',
                'before'
            );
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
