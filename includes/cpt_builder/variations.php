<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * Registers a `core/query` (Query Loop) variation per active CPT definition, with its fields
 * pre-bound to post meta — image fields to the `odiseia/attachment` source too (see
 * Image_Binding) — so a developer can insert one ready-made Query Loop without configuring
 * bindings by hand.
 */
class Variations
{
    /**
     * 1x1 transparent GIF data URI, used as the `core/image` inner block's placeholder `url`.
     *
     * `url`/`alt` bindings only ever REPLACE an existing `<img>` tag's attributes
     * (WP_Block::replace_html()'s 'attribute' case); render_block_core_image() also bails out to
     * '' when the block's own saved content has no `<img src>` at all (wp-includes/blocks/image.php:21).
     * Since the variation's inner blocks are serialized once, when the developer inserts/saves
     * the template, and the binding then overrides src/alt PER POST at render time, the template
     * needs its own `<img>` tag to exist from the start — a data URI avoids depending on any
     * attachment existing in the media library.
     */
    const PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

    /**
     * Hooks the variations filter. Called directly from Cpt_Builder::init() (an `init` callback
     * itself), not wrapped in its own add_action('init', ...): `init` has already started firing
     * by then, so a nested add_action('init', ...) here would never run.
     */
    public static function init()
    {
        add_filter('get_block_type_variations', [self::class, 'filter_query_variations'], 10, 2);
    }

    /**
     * @param array          $variations Existing variations for $block_type.
     * @param \WP_Block_Type $block_type Block type being filtered.
     * @return array
     */
    public static function filter_query_variations($variations, $block_type)
    {
        if ('core/query' !== $block_type->name) {
            return $variations;
        }

        // Not cached in a variation_callback: must reflect pause/resume/delete immediately,
        // without waiting for a rewrite flush (same reasoning as Registrar::register_all()).
        foreach (Storage::all() as $slug => $entry) {
            if ('publish' !== $entry['status']) {
                continue; // Paused/trashed CPTs are not registered — nothing to query.
            }

            $variations[] = self::build_variation($slug, $entry['definition']);
        }

        return $variations;
    }

    /**
     * @param string $slug       CPT slug.
     * @param array  $definition Normalized definition (see Definition::normalize()).
     * @return array Query Loop variation.
     */
    private static function build_variation($slug, array $definition)
    {
        return [
            'name'        => "odiseia-$slug",
            'title'       => $definition['labels']['plural'],
            'description' => sprintf(
                /* translators: %s: CPT plural label. */
                __('Query Loop pre-configured for %s, with fields bound to their post meta.', 'odiseiaframework'),
                $definition['labels']['plural']
            ),
            'icon'        => $definition['menu_icon'],
            'scope'       => ['inserter'],
            'isActive'    => ['namespace'],
            'attributes'  => [
                'namespace' => "odiseia/cpt-$slug",
                'query'     => [
                    'perPage'  => 10,
                    'pages'    => 0,
                    'offset'   => 0,
                    'postType' => $slug,
                    'order'    => 'desc',
                    'orderBy'  => 'date',
                    'author'   => '',
                    'search'   => '',
                    'exclude'  => [],
                    'sticky'   => '',
                    'inherit'  => false,
                ],
            ],
            'innerBlocks' => [
                [
                    'name'        => 'core/post-template',
                    'attributes'  => [],
                    'innerBlocks' => array_merge(
                        [['name' => 'core/post-title', 'attributes' => ['isLink' => true], 'innerBlocks' => []]],
                        self::field_blocks($definition['fields'])
                    ),
                ],
                ['name' => 'core/query-pagination', 'attributes' => [], 'innerBlocks' => []],
                ['name' => 'core/query-no-results', 'attributes' => [], 'innerBlocks' => []],
            ],
        ];
    }

    /**
     * One inner block per field, bound to its post meta key.
     *
     * @param array $fields Definition fields (see Definition schema).
     * @return array[]
     */
    private static function field_blocks(array $fields)
    {
        $blocks = [];
        foreach ($fields as $field) {
            $blocks[] = self::field_block($field['key'], $field['type'], $field['label']);
        }

        return $blocks;
    }

    /**
     * @param string $key   Field (and post meta) key.
     * @param string $type  Field type (see Definition::FIELD_TYPES).
     * @param string $label Field label, used as static text where the block needs one.
     * @return array Inner block definition (see the REST block-types schema's innerBlocks shape).
     */
    private static function field_block($key, $type, $label)
    {
        $meta_binding = ['source' => 'core/post-meta', 'args' => ['key' => $key]];

        switch ($type) {
            case 'date':
                return [
                    'name'        => 'core/post-date',
                    'attributes'  => ['metadata' => ['bindings' => ['datetime' => $meta_binding]]],
                    'innerBlocks' => [],
                ];

            case 'url':
                return [
                    'name'        => 'core/buttons',
                    'attributes'  => [],
                    'innerBlocks' => [[
                        'name'       => 'core/button',
                        'attributes' => [
                            'text'     => $label,
                            'metadata' => ['bindings' => ['url' => $meta_binding]],
                        ],
                        'innerBlocks' => [],
                    ]],
                ];

            case 'image':
                return [
                    'name'       => 'core/image',
                    'attributes' => [
                        'url'      => self::PLACEHOLDER_IMAGE,
                        'alt'      => '',
                        // Must be truthy: save.js only writes the `wp-image-{id}` classname onto
                        // the saved <img> tag when `id` is truthy. That classname is what lets
                        // render_block_core_image()'s class-fix (wp-includes/blocks/image.php:60-73)
                        // find-and-replace it with the REAL resolved attachment id at render time
                        // (via preg_replace, which no-ops if the class is missing entirely) — and
                        // that classname is in turn what wp_filter_content_tags() matches to add
                        // srcset/sizes. The actual placeholder number is irrelevant; it is always
                        // overwritten before the page is ever served.
                        'id'       => 1,
                        'metadata' => [
                            'bindings' => [
                                'id'  => $meta_binding,
                                'url' => ['source' => Image_Binding::SOURCE_NAME, 'args' => ['key' => $key]],
                                'alt' => ['source' => Image_Binding::SOURCE_NAME, 'args' => ['key' => $key]],
                            ],
                        ],
                    ],
                    'innerBlocks' => [],
                ];

            case 'text':
            case 'number':
            default:
                return [
                    'name'       => 'core/paragraph',
                    'attributes' => [
                        'placeholder' => $label,
                        'metadata'    => ['bindings' => ['content' => $meta_binding]],
                    ],
                    'innerBlocks' => [],
                ];
        }
    }
}
