<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * Registers the `odiseia/attachment` block bindings source.
 *
 * `core/image`'s `id` attribute has no HTML source (see
 * wp-includes/blocks/image/block.json — `id` has no `source` key), so binding only `id` to
 * `core/post-meta` never changes the rendered `<img>` tag: WP_Block::replace_html() only splices
 * HTML when the target attribute is `source: "attribute"` or `source: "rich-text"`
 * (wp-includes/class-wp-block.php). `url` and `alt` ARE attribute-sourced from the `<img>` tag's
 * `src`/`alt`, so this source resolves them from the SAME field meta key already bound to `id`
 * (see Variations::field_block()'s 'image' case) by reading the attachment it points to.
 */
class Image_Binding
{
    const SOURCE_NAME = 'odiseia/attachment';

    /**
     * Registers the source. Called directly from Cpt_Builder::init() (already an `init` callback
     * — see register_block_bindings_source()'s own docblock), not wrapped in another add_action(),
     * since `init` has already started firing by the time Cpt_Builder::init() runs.
     */
    public static function register_source()
    {
        register_block_bindings_source(self::SOURCE_NAME, [
            'label'              => __('OdiseIa Attachment', 'odiseiaframework'),
            'get_value_callback' => [self::class, 'get_value'],
            'uses_context'       => ['postId', 'postType'],
        ]);
    }

    /**
     * Resolves `url`/`alt` for the attachment stored in an image field's post meta.
     *
     * @param array     $source_args    `{"key": "<field key>"}`.
     * @param \WP_Block $block_instance The block instance being rendered.
     * @param string    $attribute_name 'url' or 'alt' (whichever attribute core bound).
     * @return string|null Null when the value cannot (or must not) be resolved.
     */
    public static function get_value(array $source_args, $block_instance, $attribute_name)
    {
        if (empty($source_args['key']) || empty($block_instance->context['postId'])) {
            return null;
        }

        $post_id = $block_instance->context['postId'];
        $post    = get_post($post_id);

        // Mirrors core's own post-meta source (wp-includes/block-bindings/post-meta.php): a
        // private/draft/password-protected post's meta — including which attachment it points
        // to — must not leak to a visitor who cannot read it.
        if (null === $post
            || (! is_post_publicly_viewable($post) && ! current_user_can('read_post', $post_id))
            || post_password_required($post)
        ) {
            return null;
        }

        if (is_protected_meta($source_args['key'], 'post')) {
            return null;
        }

        $post_type = isset($block_instance->context['postType']) ? $block_instance->context['postType'] : $post->post_type;
        $meta_keys = get_registered_meta_keys('post', $post_type);
        $meta_keys = array_merge($meta_keys, get_registered_meta_keys('post', ''));
        if (empty($meta_keys[$source_args['key']]['show_in_rest'])) {
            return null;
        }

        $attachment_id = absint(get_post_meta($post_id, $source_args['key'], true));
        if (! $attachment_id || 'attachment' !== get_post_type($attachment_id) || ! wp_attachment_is_image($attachment_id)) {
            return null;
        }

        if ('alt' === $attribute_name) {
            return get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        }

        if ('url' === $attribute_name) {
            $url = wp_get_attachment_image_url($attachment_id, 'full');

            return false !== $url ? $url : null;
        }

        return null;
    }
}
