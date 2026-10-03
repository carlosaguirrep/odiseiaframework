<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * Turns active (published) CPT definitions into registered post types and post meta.
 *
 * WordPress keeps no persistent registry of custom post types, so this runs on every request via
 * Cpt_Builder::init() (`init` priority 10, after default taxonomies at priority 0).
 */
class Registrar
{
    /**
     * Option recording slugs skipped this request because another plugin/theme already owns
     * them. Read by render_collision_notice().
     */
    const COLLISIONS_OPTION = 'odiseia_cpt_collisions';

    /**
     * Registers every active definition's post type and meta fields.
     */
    public static function register_all()
    {
        foreach (Storage::all() as $slug => $entry) {
            if ('publish' !== $entry['status']) {
                continue; // Paused (draft): keep posts/meta, stop registering.
            }

            self::register_one($slug, $entry['definition']);
        }
    }

    /**
     * Registers one definition, or skips it with an admin notice if another plugin/theme has
     * already claimed the slug (register_post_type() would otherwise silently replace it).
     */
    private static function register_one($slug, array $definition)
    {
        if (post_type_exists($slug)) {
            self::flag_collision($slug);
            return;
        }

        // Required for the REST `meta` field to exist on the post type; not part of the stored
        // schema because it is an implementation detail of field storage, not a user choice.
        $supports   = $definition['supports'];
        $supports[] = 'custom-fields';

        $result = register_post_type($slug, [
            'label'        => $definition['labels']['plural'],
            'labels'       => [
                'name'          => $definition['labels']['plural'],
                'singular_name' => $definition['labels']['singular'],
            ],
            'description'  => $definition['description'],
            'public'       => (bool) $definition['public'],
            'has_archive'  => (bool) $definition['has_archive'],
            'hierarchical' => (bool) $definition['hierarchical'],
            'menu_icon'    => $definition['menu_icon'],
            'supports'     => $supports,
            'taxonomies'   => $definition['taxonomies'],
            'show_in_rest' => true,
        ]);

        if (is_wp_error($result)) {
            return;
        }

        $revisions_enabled = post_type_supports($slug, 'revisions');
        foreach ($definition['fields'] as $field) {
            $config = self::meta_config($field['type']);
            register_post_meta($slug, $field['key'], [
                'single'            => true,
                'show_in_rest'      => true,
                'type'              => $config['type'],
                'sanitize_callback' => $config['sanitize_callback'],
                'revisions_enabled' => $revisions_enabled,
            ]);
        }
    }

    /**
     * Meta type and sanitize callback per field type.
     *
     * @param string $type Field type.
     * @return array{type: string, sanitize_callback: callable}
     */
    private static function meta_config($type)
    {
        $configs = [
            'text'   => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'number' => ['type' => 'number', 'sanitize_callback' => [self::class, 'sanitize_number']],
            'date'   => ['type' => 'string', 'sanitize_callback' => [self::class, 'sanitize_date']],
            'url'    => ['type' => 'string', 'sanitize_callback' => 'esc_url_raw'],
            'image'  => ['type' => 'integer', 'sanitize_callback' => [self::class, 'sanitize_image']],
        ];

        return isset($configs[$type]) ? $configs[$type] : $configs['text'];
    }

    /** @return float Sanitized number field value. */
    public static function sanitize_number($value)
    {
        return is_numeric($value) ? (float) $value : 0;
    }

    /** @return string Sanitized `Y-m-d` date, or '' when not a valid calendar date. */
    public static function sanitize_date($value)
    {
        if (! is_string($value) || ! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $matches)) {
            return '';
        }

        return checkdate((int) $matches[2], (int) $matches[3], (int) $matches[1]) ? $value : '';
    }

    /** @return int Attachment ID when it is actually an image, 0 otherwise. */
    public static function sanitize_image($value)
    {
        $id = absint($value);

        return $id && wp_attachment_is_image($id) ? $id : 0;
    }

    /**
     * Records a runtime slug collision as an option (not a class property: detection can happen
     * on any request, not only in wp-admin where render_collision_notice() runs).
     */
    private static function flag_collision($slug)
    {
        $collisions = get_option(self::COLLISIONS_OPTION, []);
        if (! is_array($collisions)) {
            $collisions = [];
        }

        if (! in_array($slug, $collisions, true)) {
            $collisions[] = $slug;
            update_option(self::COLLISIONS_OPTION, $collisions);
        }
    }

    /**
     * Renders and clears the collisions recorded by flag_collision(). Hooked to `admin_notices`.
     */
    public static function render_collision_notice()
    {
        if (! current_user_can('manage_options')) {
            return;
        }

        $collisions = get_option(self::COLLISIONS_OPTION, []);
        if (empty($collisions) || ! is_array($collisions)) {
            return;
        }

        printf(
            '<div class="notice notice-warning"><p>%s</p></div>',
            esc_html(sprintf(
                /* translators: %s: comma-separated list of post type slugs. */
                __('OdiseIa CPT Builder: these post type slugs are already registered by another plugin or theme and were skipped: %s', 'odiseiaframework'),
                implode(', ', array_map('sanitize_key', $collisions))
            ))
        );

        delete_option(self::COLLISIONS_OPTION);
    }
}
