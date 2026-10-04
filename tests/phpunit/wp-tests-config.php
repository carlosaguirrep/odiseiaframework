<?php
/**
 * WordPress test suite configuration, loaded by wp-phpunit through the
 * WP_PHPUNIT__TESTS_CONFIG environment variable (set in bootstrap.php).
 *
 * Every value can be overridden with an environment variable (CI sets them). The defaults
 * target a local DDEV site: WordPress core is the DDEV site's own install, three levels above
 * the plugin directory, and the database is a SEPARATE `wordpress_test` database.
 *
 * WARNING: the WordPress test suite DROPS every table with the configured prefix in DB_NAME on
 * each run. Never point it at the development site's database.
 */

$odiseia_env = static function ($name, $default) {
    $value = getenv($name);

    return false === $value || '' === $value ? $default : $value;
};

define('ABSPATH', rtrim($odiseia_env('WP_CORE_DIR', dirname(__DIR__, 5)), '/\\') . '/');

define('DB_NAME', $odiseia_env('WP_TESTS_DB_NAME', 'wordpress_test'));
define('DB_USER', $odiseia_env('WP_TESTS_DB_USER', 'db'));
define('DB_PASSWORD', $odiseia_env('WP_TESTS_DB_PASSWORD', 'db'));
define('DB_HOST', $odiseia_env('WP_TESTS_DB_HOST', 'db'));
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

// Safety net, evaluated before WordPress can open any connection: refuse any database whose
// name does not end in "_test" and any host outside a local allow-list (DDEV "db", loopback),
// so a misconfigured environment can never make the suite drop a real site's tables.
$odiseia_db_host = preg_replace('/:\d+\z/', '', DB_HOST);

if (! preg_match('/_test\z/', DB_NAME)) {
    fwrite(STDERR, sprintf("Refusing to run tests against database \"%s\": its name must end in \"_test\".\n", DB_NAME));
    exit(1);
}

if (! in_array($odiseia_db_host, array('db', '127.0.0.1', 'localhost'), true)) {
    fwrite(STDERR, sprintf("Refusing to run tests against DB host \"%s\": allowed hosts are db, 127.0.0.1 and localhost (optionally with :port).\n", DB_HOST));
    exit(1);
}

$table_prefix = $odiseia_env('WP_TESTS_TABLE_PREFIX', 'wptests_');

define('WP_TESTS_DOMAIN', 'example.org');
define('WP_TESTS_EMAIL', 'admin@example.org');
define('WP_TESTS_TITLE', 'OdiseIaFramework Tests');
define('WP_PHP_BINARY', 'php');
define('WPLANG', '');
define('WP_DEBUG', true);

define('AUTH_KEY', 'odiseia-tests');
define('SECURE_AUTH_KEY', 'odiseia-tests');
define('LOGGED_IN_KEY', 'odiseia-tests');
define('NONCE_KEY', 'odiseia-tests');
define('AUTH_SALT', 'odiseia-tests');
define('SECURE_AUTH_SALT', 'odiseia-tests');
define('LOGGED_IN_SALT', 'odiseia-tests');
define('NONCE_SALT', 'odiseia-tests');
