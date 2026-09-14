<?php

/**
 * Plugin Name:       OdiseIaFramework
 * Description:       Wordpress plugin for create amazing gutemberg sites
 * Version:           0.1.0
 * Requires at least: 7.0
 * Requires PHP:      7.4
 * Author:            Carlos Aguirre
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       odiseiaframework
 *
 * @package CreateBlock bn  
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}


define( 'ODISEIAFRAMEWORK_PATH', plugin_dir_path( __FILE__ ) );
define( 'ODISEIAFRAMEWORK_URL', plugin_dir_url( __FILE__ ) );

require_once ODISEIAFRAMEWORK_PATH . 'includes/autoloader.php';

function odiseiaframework_init() {
    \odiseIAFramework\IA_features\Seo::init();
    \odiseIAFramework\Blocks::init();
    \odiseIAFramework\Config::init();
    \odiseIAFramework\Ponder::init();
    \odiseIAFramework\Odiseia_Options::init();
}
add_action( 'init', 'odiseiaframework_init' );