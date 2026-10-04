<?php

use odiseIAFramework\Cpt_Builder\Image_Binding;

/**
 * Characterization tests for the `odiseia/attachment` block bindings source.
 */
class ImageBindingTest extends Cpt_Builder_TestCase
{
    const POST_TYPE = 'odiseia_listing';

    public function set_up()
    {
        parent::set_up();
        register_post_type(self::POST_TYPE, ['public' => true]);
        register_post_meta(self::POST_TYPE, 'photo', ['single' => true, 'type' => 'integer', 'show_in_rest' => true]);
    }

    public function tear_down()
    {
        unregister_post_meta(self::POST_TYPE, 'photo');
        unregister_post_type(self::POST_TYPE);
        parent::tear_down();
    }

    /**
     * Resolves $attribute for a post whose `photo` field points at $attachment_id.
     */
    private function resolve($attachment_id, $attribute, array $post_args = [], $key = 'photo')
    {
        $post_id = self::factory()->post->create(array_merge(['post_type' => self::POST_TYPE], $post_args));
        update_post_meta($post_id, $key, $attachment_id);
        $block = (object) ['context' => ['postId' => $post_id, 'postType' => self::POST_TYPE]];

        return Image_Binding::get_value(['key' => $key], $block, $attribute);
    }

    private function create_image()
    {
        $attachment_id = self::factory()->attachment->create_object([
            'file'           => 'photo.jpg',
            'post_mime_type' => 'image/jpeg',
        ]);
        update_post_meta($attachment_id, '_wp_attachment_image_alt', 'A photo');

        return $attachment_id;
    }

    public function test_resolves_url_and_alt_of_an_image_attachment()
    {
        $attachment_id = $this->create_image();

        $this->assertSame(wp_get_attachment_url($attachment_id), $this->resolve($attachment_id, 'url'));
        $this->assertSame('A photo', $this->resolve($attachment_id, 'alt'));
    }

    public function test_returns_null_when_the_id_is_not_an_image_attachment()
    {
        $pdf = self::factory()->attachment->create_object([
            'file'           => 'doc.pdf',
            'post_mime_type' => 'application/pdf',
        ]);

        $this->assertNull($this->resolve($pdf, 'url'));
        $this->assertNull($this->resolve(self::factory()->post->create(), 'url'));
        $this->assertNull($this->resolve(0, 'url'));
    }

    public function test_does_not_leak_meta_of_a_draft_post_to_visitors()
    {
        wp_set_current_user(0);

        $this->assertNull($this->resolve($this->create_image(), 'url', ['post_status' => 'draft']));
    }

    public function test_ignores_protected_and_unregistered_meta_keys()
    {
        $attachment_id = $this->create_image();

        $this->assertNull($this->resolve($attachment_id, 'url', [], '_photo'));
        $this->assertNull($this->resolve($attachment_id, 'url', [], 'not_registered'));
    }
}
