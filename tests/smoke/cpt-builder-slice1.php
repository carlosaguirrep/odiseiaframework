<?php
/**
 * CPT Builder — slice 1 smoke script (storage + registration).
 *
 * Not shipped in the plugin zip (see package.json "files"): run it from a checkout only.
 *
 * Usage (from the WordPress root, via WP-CLI):
 *
 *   ddev exec wp eval-file wp-content/plugins/odiseiaframework/tests/smoke/cpt-builder-slice1.php
 *   ddev exec wp eval-file wp-content/plugins/odiseiaframework/tests/smoke/cpt-builder-slice1.php demo
 *   ddev exec wp eval-file wp-content/plugins/odiseiaframework/tests/smoke/cpt-builder-slice1.php cleanup
 *
 * Modes:
 * - (default) Runs the PR1 storage/registration assertions end to end (invalid slugs and fields
 *             rejected, save + registration + meta keys for every field type, paused definitions
 *             skipped, rewrite-flush flag lifecycle, JSON round-trip with quotes/backslashes) and
 *             deletes every definition it created. Exits non-zero on the first failed assertion.
 * - demo      Creates (or reuses) an active "Demo Listing" definition (`odiseia_demo`) with one
 *             field of every slice-1 type, so the CPT shows up in wp-admin for a manual look.
 *             Left in place on purpose — run `cleanup` to remove it when you are done.
 * - cleanup   Deletes the `odiseia_demo` definition and any posts of that type.
 *
 * Gotcha: `init` has already fired by the time this script runs (WP-CLI boots WordPress fully,
 * including plugins), so a definition saved here is not registered yet — the real plugin only
 * registers a newly active definition on the *next* request. This script calls
 * Registrar::register_all() directly to simulate that next request instead of re-firing `init`,
 * which would double-register unrelated core post types and emit noisy notices.
 */

use odiseIAFramework\Cpt_Builder\Cpt_Builder;
use odiseIAFramework\Cpt_Builder\Definition;
use odiseIAFramework\Cpt_Builder\Registrar;
use odiseIAFramework\Cpt_Builder\Storage;

define('ODISEIA_SMOKE_SLUG_ACTIVE', 'odiseia_smoke_test');
define('ODISEIA_SMOKE_SLUG_PAUSED', 'odiseia_smoke_pause');
define('ODISEIA_SMOKE_SLUG_JSON', 'odiseia_smoke_json');
define('ODISEIA_DEMO_SLUG', 'odiseia_demo');

/**
 * One field of every slice-1 type, for registration/meta assertions and the demo CPT alike.
 *
 * @return array<int, array{key: string, label: string, type: string}>
 */
function odiseia_smoke_all_type_fields()
{
    return [
        ['key' => 'headline', 'label' => 'Headline', 'type' => 'text'],
        ['key' => 'price', 'label' => 'Price', 'type' => 'number'],
        ['key' => 'available_from', 'label' => 'Available From', 'type' => 'date'],
        ['key' => 'website', 'label' => 'Website', 'type' => 'url'],
        ['key' => 'cover_image', 'label' => 'Cover Image', 'type' => 'image'],
    ];
}

/**
 * Expected `register_post_meta()` type per field type (see Registrar::meta_config()).
 *
 * @return array<string, string>
 */
function odiseia_smoke_expected_meta_types()
{
    return [
        'headline'       => 'string',
        'price'          => 'number',
        'available_from' => 'string',
        'website'        => 'string',
        'cover_image'    => 'integer',
    ];
}

/** @return array True-type-coerced definition ready for Storage::save(). */
function odiseia_smoke_build_definition($slug, $singular, $plural, array $fields)
{
    return Definition::normalize([
        'slug'   => $slug,
        'labels' => ['singular' => $singular, 'plural' => $plural],
        'fields' => $fields,
    ]);
}

/** @return bool Whether $errors contains an entry matching $path and $code. */
function odiseia_smoke_has_error(array $errors, $path, $code)
{
    foreach ($errors as $error) {
        if ($error['path'] === $path && $error['code'] === $code) {
            return true;
        }
    }

    return false;
}

/**
 * Deletes a smoke/demo definition (any status) and, when its post type is currently registered,
 * every post of that type. Safe to call when nothing exists.
 */
function odiseia_smoke_delete_definition($slug)
{
    $entry = Storage::get($slug);
    if (null === $entry) {
        return;
    }

    if (post_type_exists($slug)) {
        $posts = get_posts([
            'post_type'      => $slug,
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
        ]);
        foreach ($posts as $post_id) {
            wp_delete_post($post_id, true);
        }
    }

    wp_delete_post($entry['post_id'], true);
}

/**
 * Runs one assertion, recording a failure message instead of throwing so the script can report
 * every broken assertion in a single run.
 */
function odiseia_smoke_assert($condition, $message, array &$failures)
{
    if ($condition) {
        WP_CLI::log("  OK   $message");
    } else {
        WP_CLI::log("  FAIL $message");
        $failures[] = $message;
    }
}

/** Runs every PR1 assertion and cleans up everything it created, regardless of outcome. */
function odiseia_smoke_run_assertions()
{
    $failures = [];

    // Start clean in case a previous run was interrupted before reaching cleanup.
    odiseia_smoke_delete_definition(ODISEIA_SMOKE_SLUG_ACTIVE);
    odiseia_smoke_delete_definition(ODISEIA_SMOKE_SLUG_PAUSED);
    odiseia_smoke_delete_definition(ODISEIA_SMOKE_SLUG_JSON);

    try {
        // --- Invalid slugs and fields are rejected (Definition::validate(), no persistence) ---
        $reserved = Definition::normalize(['slug' => 'page', 'labels' => ['singular' => 'X', 'plural' => 'Xs']]);
        odiseia_smoke_assert(
            odiseia_smoke_has_error(Definition::validate($reserved), 'slug', 'reserved'),
            'reserved slug "page" is rejected',
            $failures
        );

        $too_long = Definition::normalize([
            'slug'   => str_repeat('a', 21),
            'labels' => ['singular' => 'X', 'plural' => 'Xs'],
        ]);
        odiseia_smoke_assert(
            odiseia_smoke_has_error(Definition::validate($too_long), 'slug', 'too_long'),
            'slug longer than 20 characters is rejected',
            $failures
        );

        $bad_fields = Definition::normalize([
            'slug'   => 'odiseia_smoke_bad',
            'labels' => ['singular' => 'X', 'plural' => 'Xs'],
            'fields' => [
                ['key' => 'price', 'label' => 'Price', 'type' => 'number'],
                ['key' => 'price', 'label' => 'Price Again', 'type' => 'unknown'],
            ],
        ]);
        $bad_field_errors = Definition::validate($bad_fields);
        odiseia_smoke_assert(
            odiseia_smoke_has_error($bad_field_errors, 'fields.1.key', 'duplicate'),
            'duplicate field key is rejected',
            $failures
        );
        odiseia_smoke_assert(
            odiseia_smoke_has_error($bad_field_errors, 'fields.1.type', 'invalid'),
            'unrecognized field type is rejected',
            $failures
        );

        // --- Save, register, and inspect meta for an active definition with every field type ---
        $active = odiseia_smoke_build_definition(
            ODISEIA_SMOKE_SLUG_ACTIVE,
            'Smoke Test',
            'Smoke Tests',
            odiseia_smoke_all_type_fields()
        );
        $active_post_id = Storage::save($active);
        odiseia_smoke_assert($active_post_id > 0, 'active definition saves successfully', $failures);

        // --- A definition paused before the next registration pass never registers ---
        $paused = odiseia_smoke_build_definition(
            ODISEIA_SMOKE_SLUG_PAUSED,
            'Smoke Pause',
            'Smoke Pauses',
            [['key' => 'headline', 'label' => 'Headline', 'type' => 'text']]
        );
        $paused_post_id = Storage::save($paused);
        odiseia_smoke_assert($paused_post_id > 0, 'paused definition saves successfully', $failures);
        wp_update_post(['ID' => $paused_post_id, 'post_status' => 'draft']);

        // --- JSON round-trip: quotes and backslashes in labels must survive storage exactly ---
        $tricky_label = 'Smoke "quoted" value \\ backslash';
        $json_def     = odiseia_smoke_build_definition(
            ODISEIA_SMOKE_SLUG_JSON,
            $tricky_label,
            'Smoke JSON Tests',
            [['key' => 'note', 'label' => $tricky_label, 'type' => 'text']]
        );
        $json_post_id = Storage::save($json_def);
        odiseia_smoke_assert($json_post_id > 0, 'definition with quotes/backslashes saves successfully', $failures);

        $flush_after_saves = get_option(Storage::FLUSH_OPTION);
        odiseia_smoke_assert((bool) $flush_after_saves, 'rewrite-flush flag is set after saving', $failures);

        $json_entry = Storage::get(ODISEIA_SMOKE_SLUG_JSON);
        odiseia_smoke_assert(
            null !== $json_entry
                && $json_entry['definition']['labels']['singular'] === $tricky_label
                && $json_entry['definition']['fields'][0]['label'] === $tricky_label,
            'quotes and backslashes round-trip exactly through JSON storage',
            $failures
        );

        // Simulates the next request: init() already ran before this script started, so
        // registration for newly-saved definitions has to be triggered explicitly here.
        Registrar::register_all();

        odiseia_smoke_assert(
            post_type_exists(ODISEIA_SMOKE_SLUG_ACTIVE),
            'active definition registers its post type on the next registration pass',
            $failures
        );
        odiseia_smoke_assert(
            ! post_type_exists(ODISEIA_SMOKE_SLUG_PAUSED),
            'paused definition does not register its post type',
            $failures
        );

        $registered_meta = get_registered_meta_keys('post', ODISEIA_SMOKE_SLUG_ACTIVE);
        foreach (odiseia_smoke_expected_meta_types() as $key => $expected_type) {
            odiseia_smoke_assert(
                isset($registered_meta[$key]) && $registered_meta[$key]['type'] === $expected_type,
                "meta key \"$key\" is registered with type \"$expected_type\"",
                $failures
            );
        }

        odiseia_smoke_assert(
            empty(get_registered_meta_keys('post', ODISEIA_SMOKE_SLUG_PAUSED)),
            'paused definition registers no meta keys',
            $failures
        );

        Cpt_Builder::maybe_flush_rewrite_rules();
        odiseia_smoke_assert(
            ! get_option(Storage::FLUSH_OPTION),
            'rewrite-flush flag is cleared after maybe_flush_rewrite_rules()',
            $failures
        );
    } finally {
        odiseia_smoke_delete_definition(ODISEIA_SMOKE_SLUG_ACTIVE);
        odiseia_smoke_delete_definition(ODISEIA_SMOKE_SLUG_PAUSED);
        odiseia_smoke_delete_definition(ODISEIA_SMOKE_SLUG_JSON);
    }

    if (! empty($failures)) {
        WP_CLI::error(sprintf('%d of the smoke assertions failed. See the FAIL lines above.', count($failures)));
    }

    WP_CLI::success('All CPT Builder slice 1 smoke assertions passed. Nothing left behind.');
}

/** Creates (or reactivates/updates) the demo definition and leaves it in place. */
function odiseia_smoke_run_demo()
{
    $existing = Storage::get(ODISEIA_DEMO_SLUG);
    $post_id  = $existing ? $existing['post_id'] : null;

    $definition = odiseia_smoke_build_definition(
        ODISEIA_DEMO_SLUG,
        'Demo Listing',
        'Demo Listings',
        odiseia_smoke_all_type_fields()
    );

    $saved_id = Storage::save($definition, $post_id);
    if (0 === $saved_id) {
        WP_CLI::error('Could not save the demo definition.');
    }

    if ($existing && 'publish' !== $existing['status']) {
        wp_update_post(['ID' => $saved_id, 'post_status' => 'publish']);
        update_option(Storage::FLUSH_OPTION, 1);
    }

    WP_CLI::success('Demo Listing definition saved and active (slug: odiseia_demo).');
    WP_CLI::log('On the NEXT request it will show up in wp-admin and register for real, e.g.:');
    WP_CLI::log('  ddev exec wp post-type get odiseia_demo');
    WP_CLI::log('Run with the "cleanup" argument to remove it when you are done.');
}

/** Removes the demo definition and any posts of that type. */
function odiseia_smoke_run_cleanup()
{
    if (null === Storage::get(ODISEIA_DEMO_SLUG)) {
        WP_CLI::success('Nothing to clean up: no demo definition found.');
        return;
    }

    odiseia_smoke_delete_definition(ODISEIA_DEMO_SLUG);
    WP_CLI::success('Demo Listing definition and its posts were deleted.');
}

$mode = ! empty($args[0]) ? $args[0] : 'default';

switch ($mode) {
    case 'demo':
        odiseia_smoke_run_demo();
        break;
    case 'cleanup':
        odiseia_smoke_run_cleanup();
        break;
    case 'default':
        odiseia_smoke_run_assertions();
        break;
    default:
        WP_CLI::error("Unknown mode \"$mode\". Use no argument, \"demo\", or \"cleanup\".");
}
