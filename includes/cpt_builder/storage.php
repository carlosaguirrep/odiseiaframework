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
     * Pauses an active definition: stops registering its post type (see Registrar::register_all())
     * while keeping its posts and meta untouched. Reversed by resume().
     *
     * @param string $slug CPT slug.
     * @return array{ok: bool, code?: string} code is 'not_found' or 'invalid_state' when ok is false.
     */
    public static function pause($slug)
    {
        return self::transition($slug, 'publish', 'draft');
    }

    /**
     * Resumes a paused definition: re-registers its post type on the next request.
     *
     * @param string $slug CPT slug.
     * @return array{ok: bool, code?: string}
     */
    public static function resume($slug)
    {
        return self::transition($slug, 'draft', 'publish');
    }

    /**
     * Step 1 of two-step delete: trashes this CPT's own content posts (see content_post_ids()),
     * in batches of $batch_size, then trashes the definition itself once none remain. Refuses
     * when the site's trash is disabled (EMPTY_TRASH_DAYS === 0: wp_trash_post() force-deletes
     * instead of trashing in that case, post.php:4085) and requires the slug to be typed back
     * when content posts exist.
     *
     * @param string $slug       CPT slug.
     * @param string $confirm    Developer-typed slug; only checked when content posts exist.
     * @param int    $batch_size Max content posts trashed per call.
     * @return array{ok: bool, code?: string, remaining?: int, done?: bool}
     */
    public static function trash($slug, $confirm, $batch_size = 100)
    {
        $entry = self::get($slug);
        if (null === $entry) {
            return ['ok' => false, 'code' => 'not_found'];
        }
        if ('trash' === $entry['status']) {
            return ['ok' => false, 'code' => 'already_trashed'];
        }
        if (defined('EMPTY_TRASH_DAYS') && 0 === (int) EMPTY_TRASH_DAYS) {
            return ['ok' => false, 'code' => 'trash_disabled'];
        }

        $content_count = self::usage($slug)['content'];
        if ($content_count > 0 && $confirm !== $slug) {
            return ['ok' => false, 'code' => 'confirm_mismatch'];
        }

        foreach (self::content_post_ids($slug, $batch_size) as $post_id) {
            wp_trash_post($post_id);
        }

        $remaining = self::usage($slug)['content'];
        if ($remaining > 0) {
            return ['ok' => true, 'remaining' => $remaining, 'done' => false];
        }

        wp_update_post(['ID' => $entry['post_id'], 'post_status' => 'trash'], true);
        update_option(self::FLUSH_OPTION, 1);

        return ['ok' => true, 'remaining' => 0, 'done' => true];
    }

    /**
     * Undoes trash(): restores the definition's own trashed content posts and sets the
     * definition back to 'draft' (paused), not 'publish' — the developer resumes it explicitly
     * via resume(), so a restore can never silently re-expose a CPT that was being deleted on
     * purpose.
     *
     * @param string $slug CPT slug.
     * @return array{ok: bool, code?: string}
     */
    public static function restore($slug)
    {
        $entry = self::get($slug);
        if (null === $entry) {
            return ['ok' => false, 'code' => 'not_found'];
        }
        if ('trash' !== $entry['status']) {
            return ['ok' => false, 'code' => 'invalid_state'];
        }

        foreach (self::trashed_post_ids($slug, -1) as $post_id) {
            wp_untrash_post($post_id);
        }

        wp_update_post(['ID' => $entry['post_id'], 'post_status' => 'draft'], true);
        update_option(self::FLUSH_OPTION, 1);

        return ['ok' => true];
    }

    /**
     * Step 2 of two-step delete: permanently removes already-trashed content posts (in batches),
     * then the definition itself once none remain. Only valid once trash() completed step 1.
     * Requires the slug to be typed back when trashed content posts exist.
     *
     * @param string $slug       CPT slug.
     * @param string $confirm    Developer-typed slug; only checked when trashed posts exist.
     * @param int    $batch_size Max trashed posts permanently deleted per call.
     * @return array{ok: bool, code?: string, remaining?: int, done?: bool}
     */
    public static function delete_permanently($slug, $confirm, $batch_size = 100)
    {
        $entry = self::get($slug);
        if (null === $entry) {
            return ['ok' => false, 'code' => 'not_found'];
        }
        if ('trash' !== $entry['status']) {
            return ['ok' => false, 'code' => 'invalid_state'];
        }

        $trash_count = self::usage($slug)['trash'];
        if ($trash_count > 0 && $confirm !== $slug) {
            return ['ok' => false, 'code' => 'confirm_mismatch'];
        }

        foreach (self::trashed_post_ids($slug, $batch_size) as $post_id) {
            wp_delete_post($post_id, true);
        }

        $remaining = self::usage($slug)['trash'];
        if ($remaining > 0) {
            return ['ok' => true, 'remaining' => $remaining, 'done' => false];
        }

        wp_delete_post($entry['post_id'], true);

        return ['ok' => true, 'remaining' => 0, 'done' => true];
    }

    /**
     * Content-post counts for a CPT slug, regardless of whether it is currently registered.
     *
     * Queries `$wpdb` directly rather than `wp_count_posts()`: that function bails out to an
     * empty result whenever `post_type_exists()` is false (core checks it explicitly before
     * querying), which is exactly the case for every paused or trashed definition — Registrar
     * only registers active (publish) ones. `$wpdb`/`get_posts()` build their SQL from the raw
     * `post_type` string and never require registration.
     *
     * @param string $slug CPT slug.
     * @return array{content: int, trash: int}
     */
    public static function usage($slug)
    {
        global $wpdb;

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT post_status, COUNT(*) AS num FROM {$wpdb->posts} WHERE post_type = %s GROUP BY post_status",
            $slug
        ));

        $content = 0;
        $trash   = 0;
        foreach ($rows as $row) {
            if ('trash' === $row->post_status) {
                $trash = (int) $row->num;
            } else {
                $content += (int) $row->num;
            }
        }

        return ['content' => $content, 'trash' => $trash];
    }

    /**
     * usage() for every stored definition, keyed by slug. Powers GET /usage, which the admin UI
     * uses to show content-post counts in the list and the delete confirmation dialog.
     *
     * @return array<string, array{content: int, trash: int}>
     */
    public static function usage_all()
    {
        $usage = [];
        foreach (self::find_all(['publish', 'draft', 'trash']) as $entry) {
            $usage[$entry['definition']['slug']] = self::usage($entry['definition']['slug']);
        }

        return $usage;
    }

    /**
     * Moves a definition between two lifecycle statuses (post_status), guarding that it is
     * currently in $from. Shared by pause()/resume(); content posts are never touched here.
     *
     * @param string $slug CPT slug.
     * @param string $from Required current status.
     * @param string $to   New status.
     * @return array{ok: bool, code?: string}
     */
    private static function transition($slug, $from, $to)
    {
        $entry = self::get($slug);
        if (null === $entry) {
            return ['ok' => false, 'code' => 'not_found'];
        }
        if ($from !== $entry['status']) {
            return ['ok' => false, 'code' => 'invalid_state'];
        }

        wp_update_post(['ID' => $entry['post_id'], 'post_status' => $to], true);
        update_option(self::FLUSH_OPTION, 1);

        return ['ok' => true];
    }

    /**
     * IDs of this CPT's own content posts that are not already trashed, oldest first so repeated
     * batched calls make steady progress. `post_status => 'any'` already excludes trash/auto-draft.
     *
     * @param string $slug  CPT slug.
     * @param int    $limit Max IDs returned, or -1 for all.
     * @return int[]
     */
    private static function content_post_ids($slug, $limit)
    {
        return get_posts([
            'post_type'      => $slug,
            'post_status'    => 'any',
            'posts_per_page' => $limit,
            'orderby'        => 'ID',
            'order'          => 'ASC',
            'fields'         => 'ids',
        ]);
    }

    /**
     * IDs of this CPT's own content posts currently in the trash, oldest first.
     *
     * @param string $slug  CPT slug.
     * @param int    $limit Max IDs returned, or -1 for all.
     * @return int[]
     */
    private static function trashed_post_ids($slug, $limit)
    {
        return get_posts([
            'post_type'      => $slug,
            'post_status'    => 'trash',
            'posts_per_page' => $limit,
            'orderby'        => 'ID',
            'order'          => 'ASC',
            'fields'         => 'ids',
        ]);
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
