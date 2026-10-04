<?php

use odiseIAFramework\Cpt_Builder\Definition;

/**
 * Characterization tests for Definition::normalize()/validate().
 */
class DefinitionTest extends WP_UnitTestCase
{
    public function set_up()
    {
        parent::set_up();
        // Simulates a post type owned by another plugin/theme.
        register_post_type('odiseia_taken');
    }

    public function tear_down()
    {
        unregister_post_type('odiseia_taken');
        parent::tear_down();
    }

    private static function definition(array $overrides = [])
    {
        return array_merge(Definition::normalize([
            'slug'   => 'odiseia_book',
            'labels' => ['singular' => 'Book', 'plural' => 'Books'],
            'fields' => [
                ['key' => 'isbn', 'label' => 'ISBN', 'type' => 'text'],
                ['key' => 'cover', 'label' => 'Cover', 'type' => 'image'],
            ],
        ]), $overrides);
    }

    private static function codes(array $errors)
    {
        $codes = [];
        foreach ($errors as $error) {
            $codes[$error['path']] = $error['code'];
        }

        return $codes;
    }

    public function test_valid_definition_has_no_errors()
    {
        $this->assertSame([], Definition::validate(self::definition()));
    }

    /**
     * @dataProvider invalid_slug_provider
     */
    public function test_invalid_slug_is_rejected($slug, $code)
    {
        $errors = self::codes(Definition::validate(self::definition(['slug' => $slug])));

        $this->assertSame($code, $errors['slug'] ?? null);
    }

    public function invalid_slug_provider()
    {
        return [
            'empty'               => ['', 'invalid_format'],
            'leading digit'       => ['9lives', 'invalid_format'],
            'uppercase'           => ['Book', 'invalid_format'],
            'longer than 20'      => ['abcdefghijklmnopqrstu', 'too_long'],
            'wp_ prefix'          => ['wp_books', 'reserved_prefix'],
            'core post type'      => ['page', 'reserved'],
            'storage post type'   => ['odiseia_cpt_def', 'reserved'],
            'handbook reserved'   => ['author', 'reserved'],
            'public query var'    => ['feed', 'reserved'],
            'foreign post type'   => ['odiseia_taken', 'conflict'],
        ];
    }

    public function test_slug_may_match_its_own_existing_registration()
    {
        $definition = self::definition(['slug' => 'odiseia_taken']);

        $this->assertSame([], Definition::validate($definition, 'odiseia_taken'));
    }

    public function test_labels_are_required()
    {
        $errors = self::codes(Definition::validate(self::definition(['labels' => ['singular' => ' ', 'plural' => '']])));

        $this->assertSame('required', $errors['labels.singular']);
        $this->assertSame('required', $errors['labels.plural']);
    }

    public function test_field_errors_are_reported_per_field()
    {
        $errors = self::codes(Definition::validate(self::definition(['fields' => [
            ['key' => 'price', 'label' => 'Price', 'type' => 'number'],
            ['key' => 'price', 'label' => 'Again', 'type' => 'text'],
            ['key' => '1bad', 'label' => '', 'type' => 'color'],
        ]])));

        $this->assertSame([
            'fields.1.key'   => 'duplicate',
            'fields.2.key'   => 'invalid_format',
            'fields.2.label' => 'required',
            'fields.2.type'  => 'invalid',
        ], $errors);
    }

    public function test_every_supported_field_type_is_accepted()
    {
        $fields = [];
        foreach (Definition::FIELD_TYPES as $type) {
            $fields[] = ['key' => "f_$type", 'label' => $type, 'type' => $type];
        }

        $this->assertSame([], Definition::validate(self::definition(['fields' => $fields])));
    }

    public function test_too_many_fields_is_rejected()
    {
        $fields = [];
        for ($i = 0; $i <= Definition::MAX_FIELDS; $i++) {
            $fields[] = ['key' => "f$i", 'label' => "F$i", 'type' => 'text'];
        }

        $errors = self::codes(Definition::validate(self::definition(['fields' => $fields])));

        $this->assertSame('too_many', $errors['fields']);
    }

    public function test_lenient_normalize_drops_unknown_field_types()
    {
        $raw = ['fields' => [
            ['key' => 'ok', 'label' => 'Ok', 'type' => 'url'],
            ['key' => 'nope', 'label' => 'Nope', 'type' => 'color'],
            'not-an-array',
        ]];

        $this->assertCount(1, Definition::normalize($raw, true)['fields']);
        $this->assertCount(3, Definition::normalize($raw)['fields']);
    }

    public function test_migrate_rejects_newer_schema_versions()
    {
        $this->assertNull(Definition::migrate(['schema_version' => Definition::SCHEMA_VERSION + 1]));
    }
}
