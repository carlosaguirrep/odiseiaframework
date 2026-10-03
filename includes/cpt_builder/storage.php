<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * CRUD over `odiseia_cpt_def` posts: each post stores one CPT definition as JSON in post meta.
 *
 * The post type is private (not public, no UI, no REST, no rewrite, no query var): only this
 * class and the REST controller (added in a later slice) read or write it directly. The slug
 * lives inside the JSON, never in `post_name`: `wp_unique_post_slug()` silently suffixes
 * duplicate post slugs and `wp_trash_post()` appends `__trashed` on trash, which would corrupt
 * the identifier used for registration and uniqueness checks.
 */
class Storage
{
    const POST_TYPE = 'odiseia_cpt_def';

    const META_KEY = '_odiseia_cpt_definition';

    /**
     * Option flagging that rewrite rules need a flush after a definition changed. Cleared and
     * applied on `wp_loaded`, see Cpt_Builder::maybe_flush_rewrite_rules().
     */
    const FLUSH_OPTION = 'odiseia_cpt_flush_rewrite';

    /**
     * Registers the private storage post type. Called once from Cpt_Builder::init().
     */
    public static function register_post_type()
    {
        register_post_type(self::POST_TYPE, [
            'public'           => false,
            'show_ui'          => false,
            'show_in_rest'     => false,
            'rewrite'          => false,
            'query_var'        => false,
            'supports'         => ['title'],
            // Without this, the type falls back to 'post' capabilities, so any role that can
            // edit posts (e.g. Author) could also edit/delete other users' CPT definitions.
            'capability_type'  => self::POST_TYPE,
            'map_meta_cap'     => true,
            'capabilities'     => [
                'edit_posts'             => 'manage_options',
                'edit_others_posts'      => 'manage_options',
                'delete_posts'           => 'manage_options',
                'publish_posts'          => 'manage_options',
                'read_private_posts'     => 'manage_options',
                'create_posts'           => 'manage_options',
                'delete_others_posts'    => 'manage_options',
                'delete_private_posts'   => 'manage_options',
                'delete_published_posts' => 'manage_options',
                'edit_private_posts'     => 'manage_options',
                'edit_published_posts'   => 'manage_options',
            ],
        ]);
    }

    /**
     * Active and paused definitions, keyed by slug. Trashed definitions (pending permanent
     * delete) are excluded: their CPT must stop registering as soon as trash starts.
     *
     * @return array<string, array{post_id: int, status: string, definition: array}>
     */
    public static function all()
    {
        $by_slug = [];
        foreach (self::find_all(['publish', 'draft']) as $entry) {
            $by_slug[$entry['definition']['slug']] = $entry;
        }

        return $by_slug;
    }

    /**
     * A single definition by slug, in any status (including trashed). Null when not found.
     *
     * @param string $slug CPT slug.
     * @return array{post_id: int, status: string, definition: array}|null
     */
    public static function get($slug)
    {
        foreach (self::find_all(['publish', 'draft', 'trash']) as $entry) {
            if ($entry['definition']['slug'] === $slug) {
                return $entry;
            }
        }

        return null;
    }

    /**
     * Creates or updates a definition.
     *
     * @param array    $definition Normalized, validated definition (see Definition::normalize()).
     * @param int|null $post_id    Existing post ID to update, or null to create.
     * @return int Post ID, or 0 on failure.
     */
    public static function save(array $definition, $post_id = null)
    {
        $current_slug = $post_id ? self::slug_of($post_id) : null;
        if (! empty(Definition::validate($definition, $current_slug))) {
            return 0;
        }

        // Another stored definition (publish/draft/trash) already owns this slug: reject before
        // Registrar ever runs, instead of letting two definitions silently race for the same CPT.
        $owner = self::get($definition['slug']);
        if (null !== $owner && $owner['post_id'] !== $post_id) {
            return 0;
        }

        $title = ! empty($definition['labels']['plural']) ? $definition['labels']['plural'] : $definition['slug'];

        $post_data = [
            'post_type'   => self::POST_TYPE,
            'post_title'  => $title,
            'post_status' => $post_id ? get_post_status($post_id) : 'publish',
        ];

        if ($post_id) {
            $post_data['ID'] = $post_id;
            $result = wp_update_post($post_data, true);
        } else {
            $result = wp_insert_post($post_data, true);
        }

        if (is_wp_error($result)) {
            return 0;
        }

        // update_post_meta() unslashes its value on the way in, so the JSON must be slashed
        // first or backslashes/quotes inside labels and descriptions get corrupted.
        update_post_meta($result, self::META_KEY, wp_slash(wp_json_encode($definition)));

        update_option(self::FLUSH_OPTION, 1);

        return $result;
    }

    /**
     * Fetches definition posts in the given statuses and decodes their meta.
     *
     * @param string[] $statuses Post statuses to include.
     * @return array<int, array{post_id: int, status: string, definition: array}>
     */
    private static function find_all(array $statuses)
    {
        $posts = get_posts([
            'post_type'      => self::POST_TYPE,
            'post_status'    => $statuses,
            'posts_per_page' => -1,
            'orderby'        => 'ID',
            'order'          => 'ASC',
        ]);

        $entries = [];
        foreach ($posts as $post) {
            $definition = self::read_meta($post->ID);
            if (null === $definition || empty($definition['slug'])) {
                continue;
            }

            $entries[] = [
                'post_id'    => $post->ID,
                'status'     => $post->post_status,
                'definition' => $definition,
            ];
        }

        return $entries;
    }

    /**
     * The slug currently stored for a definition post, if any. Used by save() to let an update
     * keep its own slug without tripping the "slug already in use" check.
     *
     * @param int $post_id Definition post ID.
     * @return string|null
     */
    private static function slug_of($post_id)
    {
        $definition = self::read_meta($post_id);

        return $definition ? $definition['slug'] : null;
    }

    /**
     * Reads and decodes a definition's JSON meta, migrating it to the current schema version.
     *
     * @param int $post_id Definition post ID.
     * @return array|null Migrated definition, or null when missing, malformed, or too new.
     */
    private static function read_meta($post_id)
    {
        $raw = get_post_meta($post_id, self::META_KEY, true);
        if (! is_string($raw) || '' === $raw) {
            return null;
        }

        $data = json_decode($raw, true);
        if (! is_array($data)) {
            return null;
        }

        return Definition::migrate($data);
    }
}
