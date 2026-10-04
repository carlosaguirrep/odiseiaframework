<?php

use odiseIAFramework\Cpt_Builder\Definition;
use odiseIAFramework\Cpt_Builder\Image_Binding;
use odiseIAFramework\Cpt_Builder\Storage;

/**
 * Base case for CPT Builder tests: resets the per-request static caches that would otherwise
 * leak between tests (each test's DB writes are rolled back, the caches are not).
 */
abstract class Cpt_Builder_TestCase extends WP_UnitTestCase
{
    public function set_up()
    {
        parent::set_up();
        self::reset_static(Storage::class, 'cache');
        self::reset_static(Image_Binding::class, 'cache');
    }

    protected static function reset_static($class, $property)
    {
        $reflection = new ReflectionProperty($class, $property);
        $reflection->setAccessible(true);
        $reflection->setValue(null, []);
    }

    /**
     * Saves a valid definition and returns its post ID.
     */
    protected static function save_definition($slug, array $raw = [])
    {
        $definition = Definition::normalize(array_merge([
            'slug'   => $slug,
            'labels' => ['singular' => 'Item', 'plural' => 'Items'],
            'fields' => [['key' => 'price', 'label' => 'Price', 'type' => 'number']],
        ], $raw));

        return Storage::save($definition);
    }
}
