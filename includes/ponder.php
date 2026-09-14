<?php 

namespace odiseIAFramework;

// HERE IS ALL THE FUNCTIONS TO PONDER THE NATIVE BLOCKS AND GUTEMBERG FUNCTIONALITIES

class Ponder{

    public static function init()
    {
        add_action('enqueue_block_editor_assets', [__CLASS__,'odiseia_responsive_options']);
        add_action('enqueue_block_assets', [__CLASS__,'odiseia_responsive_styles']);
    }

    public static function odiseia_responsive_options()
    {
        wp_enqueue_script(
            'odiseiaframework-responsive',
            ODISEIAFRAMEWORK_URL.'build/Plugins/responsive.js',
            ['wp-hooks', 'wp-blocks', 'wp-element','wp-i18n','wp-editor'],
            '0.1.0',
        true); 

       /* wp_enqueue_script(
            'odiseiaframework-responsive-spacing',
            ODISEIAFRAMEWORK_URL.'build/Plugins/responsiveSpacing.js',
            ['wp-hooks', 'wp-blocks', 'wp-element','wp-i18n','wp-editor'],
            '0.1.0',
        true); */
    }

    public static function odiseia_responsive_styles()
    {
        wp_enqueue_style(
            'gutemberg-responsive-css',
            ODISEIAFRAMEWORK_URL.'assets/responsive.css',
            array()
        );
    }

}