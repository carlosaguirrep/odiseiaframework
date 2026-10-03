<?php

namespace odiseIAFramework\Cpt_Builder;

/**
 * CPT definition schema: normalization, validation, and version migration.
 *
 * A definition is the JSON structure stored in Storage::META_KEY on an `odiseia_cpt_def` post.
 * Lifecycle state (active/paused/trashed) lives in the post's `post_status`, not in this schema.
 */
class Definition
{
    /**
     * Current schema version. migrate() upgrades older stored documents to this version;
     * documents with a higher version (saved by a newer plugin release) are rejected.
     */
    const SCHEMA_VERSION = 1;

    /**
     * Post types reserved by WordPress core, documented on the register_post_type() handbook
     * page, plus this plugin's own storage post type.
     *
     * @var string[]
     */
    const RESERVED_SLUGS = [
        'post', 'page', 'attachment', 'revision', 'nav_menu_item', 'custom_css',
        'customize_changeset', 'oembed_cache', 'user_request', 'wp_block', 'wp_template',
        'wp_template_part', 'wp_global_styles', 'wp_navigation', 'wp_font_family', 'wp_font_face',
        'odiseia_cpt_def',
        // Also documented on the register_post_type() handbook page as interfering with core
        // behaviour (query vars/rewrites) even though they are not themselves post type names.
        'action', 'author', 'order', 'theme',
    ];

    /**
     * Supported field types.
     *
     * @var string[]
     */
    const FIELD_TYPES = ['text', 'number', 'date', 'url', 'image'];

    /**
     * Taxonomies a definition may associate with its CPT.
     *
     * @var string[]
     */
    const ALLOWED_TAXONOMIES = ['category', 'post_tag'];

    /**
     * Maximum number of fields per definition.
     */
    const MAX_FIELDS = 30;

    /**
     * Builds a type-coerced definition array from raw (REST/import/AI) input. Does not validate.
     * `custom-fields` is added to `supports` by the registrar, not stored here.
     *
     * @param array $raw     Raw submitted data.
     * @param bool  $lenient Drop field entries with no recognized type instead of keeping them
     *                       for validate() to report. Used by the AI proposer.
     * @return array Normalized definition.
     */
    public static function normalize(array $raw, $lenient = false)
    {
        $fields = [];
        if (isset($raw['fields']) && is_array($raw['fields'])) {
            foreach ($raw['fields'] as $field) {
                $field = self::normalize_field($field, $lenient);
                if (null !== $field) {
                    $fields[] = $field;
                }
            }
        }

        $taxonomies = [];
        if (isset($raw['taxonomies']) && is_array($raw['taxonomies'])) {
            $taxonomies = array_values(array_intersect(
                self::ALLOWED_TAXONOMIES,
                array_map('strval', $raw['taxonomies'])
            ));
        }

        $labels = isset($raw['labels']) && is_array($raw['labels']) ? $raw['labels'] : [];

        return [
            'schema_version' => self::SCHEMA_VERSION,
            'slug'           => isset($raw['slug']) ? sanitize_key((string) $raw['slug']) : '',
            'labels'         => [
                'singular' => isset($labels['singular']) ? sanitize_text_field((string) $labels['singular']) : '',
                'plural'   => isset($labels['plural']) ? sanitize_text_field((string) $labels['plural']) : '',
            ],
            'description'  => isset($raw['description']) ? sanitize_text_field((string) $raw['description']) : '',
            'public'       => ! isset($raw['public']) || (bool) $raw['public'],
            'has_archive'  => ! isset($raw['has_archive']) || (bool) $raw['has_archive'],
            'hierarchical' => isset($raw['hierarchical']) && (bool) $raw['hierarchical'],
            'menu_icon'    => isset($raw['menu_icon']) && is_string($raw['menu_icon']) && '' !== $raw['menu_icon']
                ? sanitize_text_field($raw['menu_icon'])
                : 'dashicons-admin-post',
            'supports'   => ['title', 'editor', 'thumbnail', 'excerpt', 'revisions'],
            'taxonomies' => $taxonomies,
            'fields'     => $fields,
        ];
    }

    /**
     * Normalizes one field entry.
     *
     * @param mixed $field   Raw field entry.
     * @param bool  $lenient Whether to drop entries with an unrecognized type instead of keeping
     *                       them for validate() to report.
     * @return array{key: string, label: string, type: string}|null
     */
    private static function normalize_field($field, $lenient)
    {
        if (! is_array($field)) {
            return $lenient ? null : ['key' => '', 'label' => '', 'type' => ''];
        }

        $type = isset($field['type']) ? (string) $field['type'] : '';
        if ($lenient && ! in_array($type, self::FIELD_TYPES, true)) {
            return null;
        }

        return [
            'key'   => isset($field['key']) ? sanitize_key((string) $field['key']) : '',
            'label' => isset($field['label']) ? sanitize_text_field((string) $field['label']) : '',
            'type'  => $type,
        ];
    }

    /**
     * Validates a normalized definition.
     *
     * @param array       $definition   Normalized definition (see normalize()).
     * @param string|null $current_slug Slug of the definition being updated, if any — it is
     *                                  allowed to "conflict" with its own existing registration.
     * @return array<int, array{path: string, code: string}> Empty when valid.
     */
    public static function validate(array $definition, $current_slug = null)
    {
        $errors = [];

        $slug = isset($definition['slug']) ? (string) $definition['slug'] : '';
        if ('' === $slug || ! preg_match('/^[a-z][a-z0-9_-]*$/', $slug)) {
            $errors[] = ['path' => 'slug', 'code' => 'invalid_format'];
        } elseif (strlen($slug) > 20) {
            $errors[] = ['path' => 'slug', 'code' => 'too_long'];
        } elseif (0 === strpos($slug, 'wp_')) {
            $errors[] = ['path' => 'slug', 'code' => 'reserved_prefix'];
        } elseif (in_array($slug, self::RESERVED_SLUGS, true)) {
            $errors[] = ['path' => 'slug', 'code' => 'reserved'];
        } elseif (in_array($slug, self::public_query_vars(), true)) {
            $errors[] = ['path' => 'slug', 'code' => 'reserved'];
        } elseif ($slug !== $current_slug && post_type_exists($slug)) {
            $errors[] = ['path' => 'slug', 'code' => 'conflict'];
        }

        if ('' === trim((string) ($definition['labels']['singular'] ?? ''))) {
            $errors[] = ['path' => 'labels.singular', 'code' => 'required'];
        }
        if ('' === trim((string) ($definition['labels']['plural'] ?? ''))) {
            $errors[] = ['path' => 'labels.plural', 'code' => 'required'];
        }

        $fields = isset($definition['fields']) && is_array($definition['fields']) ? $definition['fields'] : [];
        if (count($fields) > self::MAX_FIELDS) {
            $errors[] = ['path' => 'fields', 'code' => 'too_many'];
        }

        $seen_keys = [];
        foreach ($fields as $index => $field) {
            $path = "fields.$index";
            $key  = isset($field['key']) ? (string) $field['key'] : '';
            $type = isset($field['type']) ? (string) $field['type'] : '';

            if ('' === $key || ! preg_match('/^[a-z][a-z0-9_]{0,39}$/', $key)) {
                $errors[] = ['path' => "$path.key", 'code' => 'invalid_format'];
            } elseif (isset($seen_keys[$key])) {
                $errors[] = ['path' => "$path.key", 'code' => 'duplicate'];
            } else {
                $seen_keys[$key] = true;
            }

            if ('' === trim((string) ($field['label'] ?? ''))) {
                $errors[] = ['path' => "$path.label", 'code' => 'required'];
            }

            if (! in_array($type, self::FIELD_TYPES, true)) {
                $errors[] = ['path' => "$path.type", 'code' => 'invalid'];
            }
        }

        $taxonomies = isset($definition['taxonomies']) && is_array($definition['taxonomies']) ? $definition['taxonomies'] : [];
        foreach ($taxonomies as $taxonomy) {
            if (! in_array($taxonomy, self::ALLOWED_TAXONOMIES, true)) {
                $errors[] = ['path' => 'taxonomies', 'code' => 'invalid'];
                break;
            }
        }

        return $errors;
    }

    /**
     * Reserved slugs and current public query vars combined, for the admin form's client-side
     * validation (see src/Admin/cpt-builder/validation.js). PHP stays the single source of truth:
     * the list is sent to the browser, never duplicated there, so it can never drift.
     *
     * @return string[]
     */
    public static function reserved_slugs_for_js()
    {
        return array_values(array_unique(array_merge(self::RESERVED_SLUGS, self::public_query_vars())));
    }

    /**
     * WordPress's public query vars (e.g. 'author', 'order', 'feed'): a CPT slug matching one
     * would be shadowed in `WP::parse_request()`. Reads the live, filtered list off the main
     * `$wp` object when available (reflects query vars added by other plugins), falling back to
     * a fresh `WP` instance's hardcoded defaults otherwise.
     *
     * @return string[]
     */
    private static function public_query_vars()
    {
        global $wp;

        if ($wp instanceof \WP) {
            return $wp->public_query_vars;
        }

        return (new \WP())->public_query_vars;
    }

    /**
     * Upgrades a stored definition to the current schema version.
     *
     * @param array $definition Raw definition as decoded from meta.
     * @return array|null Migrated definition, or null when its schema_version is newer than this
     *                     plugin supports (it was saved by a newer plugin version).
     */
    public static function migrate(array $definition)
    {
        $version = isset($definition['schema_version']) ? (int) $definition['schema_version'] : 1;
        if ($version > self::SCHEMA_VERSION) {
            return null;
        }

        // Version 1 is the only version so far: nothing to migrate, just re-normalize to fill
        // in any key added to the schema since the document was stored.
        return self::normalize($definition);
    }
}
