<?php

use odiseIAFramework\Cpt_Builder\Definition;
use odiseIAFramework\Cpt_Builder\Storage;

/**
 * Characterization tests for Storage save/get/all and the all() per-request cache.
 */
class StorageTest extends Cpt_Builder_TestCase
{
    public function test_save_creates_an_active_definition()
    {
        $post_id = self::save_definition('odiseia_book');

        $this->assertGreaterThan(0, $post_id);
        $entry = Storage::get('odiseia_book');
        $this->assertSame($post_id, $entry['post_id']);
        $this->assertSame('publish', $entry['status']);
        $this->assertSame('1', (string) get_option(Storage::FLUSH_OPTION));
    }

    public function test_save_rejects_an_invalid_definition()
    {
        $this->assertSame(0, self::save_definition('wp_book'));
        $this->assertNull(Storage::get('wp_book'));
    }

    public function test_save_rejects_a_slug_owned_by_another_definition()
    {
        self::save_definition('odiseia_book');

        $this->assertSame(0, self::save_definition('odiseia_book'));
    }

    public function test_update_keeps_its_own_slug()
    {
        $post_id = self::save_definition('odiseia_book');
        $updated = Definition::normalize([
            'slug'   => 'odiseia_book',
            'labels' => ['singular' => 'Novel', 'plural' => 'Novels'],
        ]);

        $this->assertSame($post_id, Storage::save($updated, $post_id));
        $this->assertSame('Novels', Storage::get('odiseia_book')['definition']['labels']['plural']);
    }

    public function test_json_round_trip_preserves_quotes_and_backslashes()
    {
        self::save_definition('odiseia_book', ['description' => 'He said "hi" \\ bye']);

        $this->assertSame('He said "hi" \\ bye', Storage::get('odiseia_book')['definition']['description']);
    }

    public function test_all_is_cached_until_a_write_invalidates_it()
    {
        $post_id = self::save_definition('odiseia_book');
        $this->assertArrayHasKey('odiseia_book', Storage::all());

        // A write that bypasses Storage is not seen: all() serves its memoized copy.
        wp_update_post(['ID' => $post_id, 'post_status' => 'draft']);
        $this->assertSame('publish', Storage::all()['odiseia_book']['status']);

        // Any Storage write clears the cache, so the next all() reads fresh data.
        self::save_definition('odiseia_film');
        $all = Storage::all();
        $this->assertSame('draft', $all['odiseia_book']['status']);
        $this->assertArrayHasKey('odiseia_film', $all);
    }

    public function test_all_excludes_trashed_definitions_unless_asked()
    {
        self::save_definition('odiseia_book');
        Storage::trash('odiseia_book', '');

        $this->assertArrayNotHasKey('odiseia_book', Storage::all());
        $this->assertSame('trash', Storage::all(true)['odiseia_book']['status']);
    }
}
