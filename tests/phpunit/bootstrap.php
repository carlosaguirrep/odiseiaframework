<?php
/**
 * PHPUnit bootstrap: loads the WordPress test suite (wp-phpunit) and this plugin.
 */

$odiseia_root = dirname(__DIR__, 2);

require_once $odiseia_root . '/vendor/autoload.php';

// The wp-phpunit autoload file sets WP_PHPUNIT__DIR; the test config lives next to this file.
putenv('WP_PHPUNIT__TESTS_CONFIG=' . __DIR__ . '/wp-tests-config.php');

$odiseia_tests_dir = getenv('WP_PHPUNIT__DIR');

require_once $odiseia_tests_dir . '/includes/functions.php';

tests_add_filter('muplugins_loaded', static function () use ($odiseia_root) {
    require $odiseia_root . '/odiseiaframework.php';
});

require $odiseia_tests_dir . '/includes/bootstrap.php';
