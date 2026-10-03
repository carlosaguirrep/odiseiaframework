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
     * Post meta set on a trashed content post by trash() and cleared by restore().
     * guard_scheduled_delete() blocks permanent deletion of exactly the posts carrying this flag
     * (plus a trashed `odiseia_cpt_def` post itself) instead of matching on post_type/slug, so a
     * foreign plugin/theme that later registers the same slug can still manage (and permanently
     * delete) its own posts without being blocked by a same-named definition we have in the
     * trash.
     *
     * The value distinguishes WHO trashed the post, which controls what restore() does with it:
     * - self::TRASHED_BY_LIFECYCLE: trash() itself moved this post to the trash. restore()
     *   untrashes it and clears the flag.
     * - self::TRASHED_PREEXISTING: the post was already in the trash (e.g. trashed manually)
     *   before trash() ran. trash() still stamps it so the guard protects it too, but restore()
     *   only clears the flag — it leaves the post trashed, since the lifecycle never trashed it.
     *
     * delete_permanently() ignores the value entirely: once the definition itself is being
     * destroyed, every trashed post for the slug (flagged or not) is removed, so none are left
     * as orphans.
     */
    const META_TRASHED_FLAG = '_odiseia_lifecycle_trashed';

    /** META_TRASHED_FLAG value for a content post that trash() itself moved to the trash. */
    const TRASHED_BY_LIFECYCLE = 'lifecycle';

    /**
     * META_TRASHED_FLAG value for a content post that was already in the trash before trash()
     * ran. See META_TRASHED_FLAG's docblock for why restore() treats this differently.
     */
    const TRASHED_PREEXISTING = 'preexisting';

    /**
     * Option flagging that rewrite rules need a flush after a definition changed. Cleared and
     * applied on `wp_loaded`, see Cpt_Builder::maybe_flush_rewrite_rules().
     */
    const FLUSH_OPTION = 'odiseia_cpt_flush_rewrite';

    /**
     * Set around the wp_delete_post() calls inside delete_permanently() so
     * guard_scheduled_delete() lets them through. Never true outside that method: this is the
     * only path allowed to permanently delete a trashed odiseia-owned post or definition.
     *
     * @var bool
     */
    private static $allow_permanent_delete = false;

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
     * Every stored definition, keyed by slug.
     *
     * @param bool $include_trash Whether to also include trashed definitions (pending permanent
     *                            delete). Registrar::register_all() keeps the default (false):
     *                            it filters by 'publish' itself, but a trashed CPT must stop
     *                            registering as soon as trash starts regardless. The admin list
     *                            (GET /definitions) passes true, since a trashed definition's
     *                            row is the only way back to Restore or step 2 of delete.
     * @return array<string, array{post_id: int, status: string, definition: array}>
     */
    public static function all($include_trash = false)
    {
        $statuses = $include_trash ? ['publish', 'draft', 'trash'] : ['publish', 'draft'];

        $by_slug = [];
        foreach (self::find_all($statuses) as $entry) {
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
     * in batches of $batch_size, then trashes the definition itself once none remain. Also
     * stamps any of this slug's posts that were ALREADY trashed before this ran (e.g. trashed
     * manually) with the META_TRASHED_FLAG::TRASHED_PREEXISTING value, batched and counted
     * together with the content posts above, so that guard_scheduled_delete() protects them too
     * while the definition waits for step 2 — restore() later tells the two kinds apart to avoid
     * un-trashing posts the lifecycle never trashed. Refuses when the site's trash is disabled
     * (EMPTY_TRASH_DAYS === 0: wp_trash_post() force-deletes instead of trashing in that case,
     * post.php:4085), when the slug is actually owned by a foreign plugin/theme registration
     * (see is_foreign_owned()), and requires the slug to be typed back when content posts exist.
     *
     * @param string $slug       CPT slug.
     * @param string $confirm    Developer-typed slug; only checked when content posts exist.
     * @param int    $batch_size Max content posts trashed, and max pre-existing trashed posts
     *                           flagged, per call.
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
        if (self::is_foreign_owned($slug, $entry['status'])) {
            return ['ok' => false, 'code' => 'collision'];
        }
        if (defined('EMPTY_TRASH_DAYS') && 0 === (int) EMPTY_TRASH_DAYS) {
            return ['ok' => false, 'code' => 'trash_disabled'];
        }

        $content_count = self::usage($slug)['content'];
        if ($content_count > 0 && $confirm !== $slug) {
            return ['ok' => false, 'code' => 'confirm_mismatch'];
        }

        $before = $content_count + self::count_unflagged_trashed($slug);

        $post_ids = self::content_post_ids($slug, $batch_size);
        foreach ($post_ids as $post_id) {
            if (wp_trash_post($post_id)) {
                update_post_meta($post_id, self::META_TRASHED_FLAG, self::TRASHED_BY_LIFECYCLE);
            }
        }

        // Posts of this slug that were already in the trash (e.g. trashed manually) before this
        // call are not something trash() put there, but they still need the flag — otherwise
        // guard_scheduled_delete() leaves them unprotected while the definition waits for step 2,
        // and restore() would later un-trash posts the lifecycle never trashed. Stamped with a
        // distinct value (see META_TRASHED_FLAG's docblock) so restore() can tell them apart.
        $preexisting_ids = self::unflagged_trashed_post_ids($slug, $batch_size);
        foreach ($preexisting_ids as $post_id) {
            update_post_meta($post_id, self::META_TRASHED_FLAG, self::TRASHED_PREEXISTING);
        }

        // Progress is measured by the remaining count, not by wp_trash_post()'s return value:
        // it returns false for a post that is already trashed, which a duplicate/concurrent
        // request would otherwise misreport as 'stuck' even though the batch is making progress
        // (see judgment-day finding F).
        $remaining = self::usage($slug)['content'] + self::count_unflagged_trashed($slug);
        if ($remaining > 0) {
            if ($remaining >= $before && (! empty($post_ids) || ! empty($preexisting_ids))) {
                return ['ok' => false, 'code' => 'stuck'];
            }

            return ['ok' => true, 'remaining' => $remaining, 'done' => false];
        }

        wp_update_post(['ID' => $entry['post_id'], 'post_status' => 'trash'], true);
        update_option(self::FLUSH_OPTION, 1);

        return ['ok' => true, 'remaining' => 0, 'done' => true];
    }

    /**
     * Undoes trash(): restores the definition's own trashed content posts, in batches of
     * $batch_size like trash()/delete_permanently(), and sets the definition back to 'draft'
     * (paused) only once none remain — not 'publish', the developer resumes it explicitly via
     * resume(), so a restore can never silently re-expose a CPT that was being deleted on
     * purpose, and never leaves the definition flipped while content posts are still trashed.
     *
     * Only acts on posts carrying META_TRASHED_FLAG (see its docblock), not every trashed post
     * for the slug: a TRASHED_BY_LIFECYCLE post is untrashed and the flag cleared, a
     * TRASHED_PREEXISTING post only has its flag cleared and is left in the trash, since
     * trash() never actually trashed it. The remaining/stuck accounting below counts only
     * flagged posts for the same reason — a trashed post this method will never touch (because
     * trash() never flagged it) must not be counted as work still pending, or restore() would
     * never be able to terminate.
     *
     * @param string $slug       CPT slug.
     * @param int    $batch_size Max flagged trashed posts processed per call.
     * @return array{ok: bool, code?: string, remaining?: int, done?: bool}
     */
    public static function restore($slug, $batch_size = 100)
    {
        $entry = self::get($slug);
        if (null === $entry) {
            return ['ok' => false, 'code' => 'not_found'];
        }
        if ('trash' !== $entry['status']) {
            return ['ok' => false, 'code' => 'invalid_state'];
        }

        $before = self::count_flagged_trashed($slug);

        $post_ids = self::flagged_trashed_post_ids($slug, $batch_size);
        foreach ($post_ids as $post_id) {
            if (self::TRASHED_PREEXISTING === get_post_meta($post_id, self::META_TRASHED_FLAG, true)) {
                delete_post_meta($post_id, self::META_TRASHED_FLAG);
                continue;
            }

            if (wp_untrash_post($post_id)) {
                delete_post_meta($post_id, self::META_TRASHED_FLAG);
            }
        }

        // Same progress-by-count reasoning as trash()/delete_permanently(): without it, a
        // restore that is simply making slow progress (or a duplicate request) could get stuck
        // behind a non-dismissible modal forever (judgment-day findings D and F).
        $remaining = self::count_flagged_trashed($slug);
        if ($remaining > 0) {
            if ($remaining >= $before && ! empty($post_ids)) {
                return ['ok' => false, 'code' => 'stuck'];
            }

            return ['ok' => true, 'remaining' => $remaining, 'done' => false];
        }

        wp_update_post(['ID' => $entry['post_id'], 'post_status' => 'draft'], true);
        update_option(self::FLUSH_OPTION, 1);

        return ['ok' => true, 'remaining' => 0, 'done' => true];
    }

    /**
     * Step 2 of two-step delete: permanently removes already-trashed content posts AND this
     * slug's auto-draft posts (in batches, sharing the same $batch_size budget — see
     * auto_draft_post_ids()), then the definition itself once none remain. Only valid once
     * trash() completed step 1. Removes ALL trashed posts of the slug regardless of
     * META_TRASHED_FLAG (unlike restore(); see its docblock): the CPT is going away entirely, so
     * a post this plugin never flagged (e.g. trashed manually) would otherwise be left behind as
     * an orphan. Refuses when the slug is actually owned by a foreign plugin/theme registration
     * (see is_foreign_owned()) and requires the slug to be typed back when trashed content posts
     * exist.
     *
     * Sets $allow_permanent_delete around every wp_delete_post() call so
     * guard_scheduled_delete() (hooked to `pre_delete_post`) lets them through — that filter
     * blocks any other caller, in particular WordPress's own `wp_scheduled_delete` cron, from
     * permanently removing a lifecycle-trashed content post or definition behind this method's
     * back.
     *
     * @param string $slug       CPT slug.
     * @param string $confirm    Developer-typed slug; only checked when trashed posts exist.
     * @param int    $batch_size Max trashed posts and auto-drafts permanently deleted per call,
     *                           combined.
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
        if (self::is_foreign_owned($slug, $entry['status'])) {
            return ['ok' => false, 'code' => 'collision'];
        }

        $trash_count = self::usage($slug)['trash'];
        if ($trash_count > 0 && $confirm !== $slug) {
            return ['ok' => false, 'code' => 'confirm_mismatch'];
        }

        $before = $trash_count + self::count_auto_drafts($slug);

        $post_ids = self::trashed_post_ids($slug, $batch_size);

        // Auto-drafts spend whatever's left of this call's batch budget after the trashed posts
        // above, instead of being deleted all at once regardless of $batch_size (judgment-day
        // round 3 finding): a slug with many trashed posts AND many auto-drafts still finishes
        // in a bounded number of calls. Guarded at 0 explicitly: get_posts()/WP_Query treats an
        // explicit posts_per_page of 0 as "unset" and falls back to the site's default page
        // size instead of returning no results, which would silently ignore a fully spent budget.
        $auto_draft_budget = max(0, $batch_size - count($post_ids));
        $auto_draft_ids    = $auto_draft_budget > 0 ? self::auto_draft_post_ids($slug, $auto_draft_budget) : [];

        self::$allow_permanent_delete = true;
        try {
            foreach ($post_ids as $post_id) {
                wp_delete_post($post_id, true);
            }
            foreach ($auto_draft_ids as $post_id) {
                wp_delete_post($post_id, true);
            }
        } finally {
            // finally: a wp_delete_post() call (or a before_delete_post hook from another
            // plugin) throwing partway through the loop must never leave the guard permanently
            // open for every subsequent permanent-delete request on the site (judgment-day
            // finding B).
            self::$allow_permanent_delete = false;
        }

        // Progress is measured by the remaining count, not by wp_delete_post()'s return value
        // (see trash()/restore(); judgment-day finding F). Auto-drafts are deliberately excluded
        // from usage()'s counts (see its docblock), so they never block trash() or trip the
        // confirm-by-slug gate above — but they are folded into THIS accounting so that, once
        // the definition itself is actually gone, its slug never leaves orphan auto-draft rows
        // behind for WordPress to stumble over later (judgment-day finding E), and a slug with
        // more auto-drafts than fit in one $batch_size still terminates across repeated calls
        // (judgment-day round 3 finding) instead of being wiped in a single unbounded query.
        $remaining = self::usage($slug)['trash'] + self::count_auto_drafts($slug);
        if ($remaining > 0) {
            if ($remaining >= $before && (! empty($post_ids) || ! empty($auto_draft_ids))) {
                return ['ok' => false, 'code' => 'stuck'];
            }

            return ['ok' => true, 'remaining' => $remaining, 'done' => false];
        }

        self::$allow_permanent_delete = true;
        try {
            wp_delete_post($entry['post_id'], true);
        } finally {
            self::$allow_permanent_delete = false;
        }

        return ['ok' => true, 'remaining' => 0, 'done' => true];
    }

    /**
     * Whether $slug's posts actually belong to a foreign plugin/theme registration rather than
     * this definition, so trash()/delete_permanently() can refuse instead of destroying posts
     * that are not theirs.
     *
     * An active ('publish') definition registers its own post type (see
     * Registrar::register_one()); when that registration lost to a pre-existing foreign one,
     * Registrar records the slug in Registrar::COLLISIONS_OPTION instead of registering it, so
     * that option is authoritative while the definition is active. Paused ('draft') and trashed
     * definitions are never registered by this plugin (Registrar::register_all() only registers
     * 'publish' ones), so any existing registration for the slug (post_type_exists()) in that
     * state must belong to someone else.
     *
     * @param string $slug   CPT slug.
     * @param string $status Definition's current post_status.
     * @return bool
     */
    private static function is_foreign_owned($slug, $status)
    {
        if ('publish' === $status) {
            $collisions = get_option(Registrar::COLLISIONS_OPTION, []);

            return is_array($collisions) && in_array($slug, $collisions, true);
        }

        return post_type_exists($slug);
    }

    /**
     * Blocks any permanent post deletion that is not routed through delete_permanently(), for a
     * post that this plugin has already put in the trash as part of its own two-step delete.
     *
     * Hooked to the core `pre_delete_post` filter (see Cpt_Builder::init(); unconditional, not
     * gated by dev tools). Without this, WordPress's `wp_scheduled_delete` cron permanently
     * deletes trashed posts older than EMPTY_TRASH_DAYS on its own, bypassing the confirm-by-slug
     * gate entirely.
     *
     * Ownership is tracked explicitly via META_TRASHED_FLAG, set by trash() on every trashed
     * content post of the slug (both the ones it trashes itself and any pre-existing trashed
     * ones it finds — see the flag's docblock) and cleared by restore() — NOT by matching
     * post_type against a trashed definition's slug. A slug match would also block a foreign
     * plugin/theme that later registers the same slug from managing (and permanently cleaning
     * up) its own trashed posts, which is exactly the kind of cross-plugin interference this
     * guard must avoid (judgment-day finding A). This also keeps the hot path cheap: a single
     * get_post_meta() call instead of self::get()'s find_all()+JSON-decode over every stored
     * definition on every permanent delete site-wide (judgment-day finding C).
     *
     * @param bool|null $check        Short-circuit value: non-null here would already skip
     *                                `wp_delete_post()`'s own logic; untouched (returned as-is)
     *                                when this call is not one we need to block.
     * @param \WP_Post  $post         Post about to be permanently deleted.
     * @param bool      $force_delete Whether the caller forced deletion. Unused: `pre_delete_post`
     *                                fires before core's own trash/force-delete branching, so a
     *                                trashed post reaches here regardless of this flag.
     * @return bool|null
     */
    public static function guard_scheduled_delete($check, $post, $force_delete)
    {
        if (self::$allow_permanent_delete || 'trash' !== $post->post_status) {
            return $check;
        }

        if (self::POST_TYPE === $post->post_type) {
            return false;
        }

        if (get_post_meta($post->ID, self::META_TRASHED_FLAG, true)) {
            return false;
        }

        return $check;
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
     * 'content' deliberately uses the SAME status set as content_post_ids() (post_status 'any',
     * which core excludes 'trash' AND 'auto-draft' from): this used to also count 'auto-draft'
     * rows as content while content_post_ids() never returned them to be trashed, so trash()
     * looped forever once only auto-drafts remained for a slug (judgment-day finding E).
     * Auto-drafts are WordPress's own unsaved-post placeholders; excluding them here means they
     * never block trash()/delete_permanently() or trip the confirm-by-slug gate. In exchange,
     * delete_permanently() removes any leftover auto-drafts for the slug directly as part of its
     * own cleanup, so a definition that is actually gone never leaves orphan auto-draft rows
     * behind for its old slug.
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
            } elseif ('auto-draft' !== $row->post_status) {
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
     * IDs of ALL of this CPT's own content posts currently in the trash, oldest first,
     * regardless of META_TRASHED_FLAG. Used only by delete_permanently(): the CPT is going away
     * entirely, so every trashed post of the slug must go with it, flagged or not (see its
     * docblock). restore() uses flagged_trashed_post_ids() instead, since it must not touch a
     * post the lifecycle never trashed.
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
     * IDs of this CPT's own trashed content posts that carry META_TRASHED_FLAG (either value),
     * oldest first. This is what restore() actually acts on — see its docblock for why a
     * trashed post without the flag must never be touched or counted by restore().
     *
     * @param string $slug  CPT slug.
     * @param int    $limit Max IDs returned, or -1 for all.
     * @return int[]
     */
    private static function flagged_trashed_post_ids($slug, $limit)
    {
        return get_posts([
            'post_type'      => $slug,
            'post_status'    => 'trash',
            'posts_per_page' => $limit,
            'orderby'        => 'ID',
            'order'          => 'ASC',
            'fields'         => 'ids',
            'meta_key'       => self::META_TRASHED_FLAG,
        ]);
    }

    /**
     * IDs of this CPT's own trashed content posts that do NOT carry META_TRASHED_FLAG, oldest
     * first — i.e. posts that were already in the trash before trash() ran. Used by trash() to
     * find which of this slug's trashed posts still need the TRASHED_PREEXISTING stamp.
     *
     * @param string $slug  CPT slug.
     * @param int    $limit Max IDs returned, or -1 for all.
     * @return int[]
     */
    private static function unflagged_trashed_post_ids($slug, $limit)
    {
        return get_posts([
            'post_type'      => $slug,
            'post_status'    => 'trash',
            'posts_per_page' => $limit,
            'orderby'        => 'ID',
            'order'          => 'ASC',
            'fields'         => 'ids',
            'meta_query'     => [
                [
                    'key'     => self::META_TRASHED_FLAG,
                    'compare' => 'NOT EXISTS',
                ],
            ],
        ]);
    }

    /**
     * Count of this CPT's own trashed content posts that carry META_TRASHED_FLAG. Backs
     * restore()'s before/remaining accounting — see flagged_trashed_post_ids().
     *
     * @param string $slug CPT slug.
     * @return int
     */
    private static function count_flagged_trashed($slug)
    {
        global $wpdb;

        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} p
                INNER JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = %s
                WHERE p.post_type = %s AND p.post_status = 'trash'",
            self::META_TRASHED_FLAG,
            $slug
        ));
    }

    /**
     * Count of this CPT's own trashed content posts that do NOT carry META_TRASHED_FLAG. Backs
     * trash()'s before/remaining accounting — see unflagged_trashed_post_ids().
     *
     * @param string $slug CPT slug.
     * @return int
     */
    private static function count_unflagged_trashed($slug)
    {
        global $wpdb;

        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} p
                LEFT JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = %s
                WHERE p.post_type = %s AND p.post_status = 'trash' AND m.post_id IS NULL",
            self::META_TRASHED_FLAG,
            $slug
        ));
    }

    /**
     * IDs of this CPT's own auto-draft posts (WordPress's unsaved-post placeholders, excluded
     * from usage()'s counts — see its docblock), oldest first. Used by delete_permanently() to
     * clean up any leftover auto-drafts for a slug once the definition itself is gone, so none
     * are left orphaned behind. Capped by $limit (shared with the trashed-post batch budget —
     * see delete_permanently()), not fetched all at once, so a slug with more auto-drafts than
     * fit in one batch still terminates across repeated calls instead of being wiped in a single
     * unbounded query.
     *
     * @param string $slug  CPT slug.
     * @param int    $limit Max IDs returned, or -1 for all.
     * @return int[]
     */
    private static function auto_draft_post_ids($slug, $limit)
    {
        return get_posts([
            'post_type'      => $slug,
            'post_status'    => 'auto-draft',
            'posts_per_page' => $limit,
            'orderby'        => 'ID',
            'order'          => 'ASC',
            'fields'         => 'ids',
        ]);
    }

    /**
     * Count of this CPT's own auto-draft posts. Backs delete_permanently()'s before/remaining
     * accounting — see auto_draft_post_ids().
     *
     * @param string $slug CPT slug.
     * @return int
     */
    private static function count_auto_drafts($slug)
    {
        global $wpdb;

        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = %s AND post_status = 'auto-draft'",
            $slug
        ));
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
