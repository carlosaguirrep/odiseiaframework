<?php

use odiseIAFramework\Cpt_Builder\Registrar;
use odiseIAFramework\Cpt_Builder\Storage;

/**
 * Characterization tests for the definition lifecycle: pause/resume, batched trash/restore and
 * delete_permanently, the META_TRASHED_FLAG scoping, the scheduled-delete guard and the
 * foreign-ownership (collision) guard.
 */
class LifecycleTest extends Cpt_Builder_TestCase
{
    const SLUG = 'odiseia_book';

    public function set_up()
    {
        parent::set_up();
        self::save_definition(self::SLUG);
    }

    public function tear_down()
    {
        if (post_type_exists(self::SLUG)) {
            unregister_post_type(self::SLUG);
        }
        parent::tear_down();
    }

    private function create_posts($count, array $args = [])
    {
        return self::factory()->post->create_many($count, array_merge(['post_type' => self::SLUG], $args));
    }

    private function status()
    {
        return Storage::get(self::SLUG)['status'];
    }

    public function test_pause_and_resume_guard_their_source_state()
    {
        $this->assertSame(['ok' => true], Storage::pause(self::SLUG));
        $this->assertSame('draft', $this->status());
        $this->assertSame(['ok' => false, 'code' => 'invalid_state'], Storage::pause(self::SLUG));

        $this->assertSame(['ok' => true], Storage::resume(self::SLUG));
        $this->assertSame('publish', $this->status());
        $this->assertSame(['ok' => false, 'code' => 'not_found'], Storage::resume('odiseia_none'));
    }

    public function test_trash_requires_the_slug_to_be_typed_back_when_content_exists()
    {
        $this->create_posts(1);

        $this->assertSame(['ok' => false, 'code' => 'confirm_mismatch'], Storage::trash(self::SLUG, 'wrong'));
        $this->assertSame('publish', $this->status());
    }

    public function test_trash_runs_in_batches_and_trashes_the_definition_last()
    {
        $post_ids = $this->create_posts(3);

        $this->assertSame(['ok' => true, 'remaining' => 1, 'done' => false], Storage::trash(self::SLUG, self::SLUG, 2));
        $this->assertSame('publish', $this->status());

        $this->assertSame(['ok' => true, 'remaining' => 0, 'done' => true], Storage::trash(self::SLUG, self::SLUG, 2));
        $this->assertSame('trash', $this->status());
        foreach ($post_ids as $post_id) {
            $this->assertSame('trash', get_post_status($post_id));
            $this->assertSame(Storage::TRASHED_BY_LIFECYCLE, get_post_meta($post_id, Storage::META_TRASHED_FLAG, true));
        }
    }

    public function test_restore_leaves_posts_that_were_trashed_before_the_lifecycle_in_the_trash()
    {
        $post_ids    = $this->create_posts(2);
        $preexisting = $this->create_posts(1)[0];
        wp_trash_post($preexisting);

        $this->assertTrue(Storage::trash(self::SLUG, self::SLUG)['done']);
        $this->assertSame(Storage::TRASHED_PREEXISTING, get_post_meta($preexisting, Storage::META_TRASHED_FLAG, true));

        $this->assertSame(['ok' => true, 'remaining' => 0, 'done' => true], Storage::restore(self::SLUG));
        // Restored as paused, never straight back to active.
        $this->assertSame('draft', $this->status());
        foreach ($post_ids as $post_id) {
            $this->assertNotSame('trash', get_post_status($post_id));
            $this->assertSame('', get_post_meta($post_id, Storage::META_TRASHED_FLAG, true));
        }
        $this->assertSame('trash', get_post_status($preexisting));
        $this->assertSame('', get_post_meta($preexisting, Storage::META_TRASHED_FLAG, true));
    }

    public function test_restore_runs_in_batches()
    {
        $this->create_posts(3);
        Storage::trash(self::SLUG, self::SLUG);

        $this->assertSame(['ok' => true, 'remaining' => 1, 'done' => false], Storage::restore(self::SLUG, 2));
        $this->assertSame('trash', $this->status());
        $this->assertTrue(Storage::restore(self::SLUG, 2)['done']);
    }

    public function test_delete_permanently_requires_a_trashed_definition()
    {
        $this->assertSame(['ok' => false, 'code' => 'invalid_state'], Storage::delete_permanently(self::SLUG, self::SLUG));
    }

    public function test_delete_permanently_removes_trashed_posts_and_auto_drafts_in_batches()
    {
        $this->create_posts(3);
        $auto_draft = $this->create_posts(1, ['post_status' => 'auto-draft'])[0];
        Storage::trash(self::SLUG, self::SLUG);

        $this->assertSame(['ok' => false, 'code' => 'confirm_mismatch'], Storage::delete_permanently(self::SLUG, ''));

        // 2 of 3 trashed posts; the auto-draft gets no budget left in this batch.
        $this->assertSame(['ok' => true, 'remaining' => 2, 'done' => false], Storage::delete_permanently(self::SLUG, self::SLUG, 2));
        $this->assertNotNull(get_post($auto_draft));

        $this->assertSame(['ok' => true, 'remaining' => 0, 'done' => true], Storage::delete_permanently(self::SLUG, self::SLUG, 2));
        $this->assertNull(Storage::get(self::SLUG));
        $this->assertNull(get_post($auto_draft));
        $this->assertSame(['content' => 0, 'trash' => 0], Storage::usage(self::SLUG));
    }

    public function test_guard_blocks_permanent_delete_outside_delete_permanently()
    {
        $post_id = $this->create_posts(1)[0];
        Storage::trash(self::SLUG, self::SLUG);
        $definition_id = Storage::get(self::SLUG)['post_id'];

        // e.g. the wp_scheduled_delete cron emptying old trash.
        wp_delete_post($post_id, true);
        wp_delete_post($definition_id, true);
        $this->assertNotNull(get_post($post_id));
        $this->assertNotNull(get_post($definition_id));

        // Unflagged trashed posts of other types are not affected.
        $other = self::factory()->post->create();
        wp_trash_post($other);
        wp_delete_post($other, true);
        $this->assertNull(get_post($other));
    }

    public function test_trash_refuses_a_slug_registered_by_someone_else()
    {
        // Active definition whose registration lost to a foreign one (flagged by Registrar).
        register_post_type(self::SLUG, ['label' => 'Foreign']);
        Registrar::register_all();
        $this->assertContains(self::SLUG, get_option(Registrar::COLLISIONS_OPTION));
        $this->assertSame('Foreign', get_post_type_object(self::SLUG)->label);
        $this->assertSame(['ok' => false, 'code' => 'collision'], Storage::trash(self::SLUG, self::SLUG));

        // Paused definition: any registration of the slug must be foreign.
        delete_option(Registrar::COLLISIONS_OPTION);
        Storage::pause(self::SLUG);
        $this->assertSame(['ok' => false, 'code' => 'collision'], Storage::trash(self::SLUG, self::SLUG));
    }

    public function test_delete_permanently_refuses_a_slug_registered_by_someone_else()
    {
        Storage::trash(self::SLUG, self::SLUG);
        register_post_type(self::SLUG);

        $this->assertSame(['ok' => false, 'code' => 'collision'], Storage::delete_permanently(self::SLUG, self::SLUG));
        $this->assertNotNull(Storage::get(self::SLUG));
    }
}
