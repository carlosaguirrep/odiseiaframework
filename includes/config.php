<?php 

namespace odiseIAFramework;

// HERE WE LOAD ALL ABOUT CONFIG AND ENEABLE SETTINGS

class Config
{

    public static function init() 
    {

        // Main Plugin Functionalities
        self::load_core_files();

        // Load Core Folder From Users
        self::load_custom_files();
        self::odiseia_eneable_theme_support();
        
        // Load Plugin Options
        $options = get_option('odiseia', []);

        // Eneable SVG UPLOAD
        if(isset($options['odiseia_eneable_svg_support']) && $options['odiseia_eneable_svg_support']) {
            add_filter( 'upload_mimes', [__CLASS__,'odiseia_enable_svg_upload'] );
        }

        // Support Scripts Eneabled 

        add_action('enqueue_block_editor_assets', [__CLASS__,'odiseia_enqueue_scripts']);

        // Eneable Animate On Scroll
        if(isset($options['odiseia_eneable_aos']) && $options['odiseia_eneable_aos']) {
            add_action('enqueue_block_assets', [__CLASS__,'odiseia_eneable_aos']);
            add_filter('render_block', [__CLASS__,'aos_animation_render_block'], 10, 2);
        }

        
    }

    /*
    ***
    ***
    *** FUNCTIONS ENEABLE SVG */

    public static function odiseia_enable_svg_upload( $mimes ) 
    {
        $mimes['svg'] = 'image/svg+xml';
        return $mimes;
    }

    /*
    ***
    ***
    *** FUNCTIONS ENEABLE AOS */

    public static function odiseia_eneable_aos()
    {
        wp_enqueue_style(
            'aos-css',
            'https://unpkg.com/aos@2.3.1/dist/aos.css'
        );
    
        // AOS JS
        wp_enqueue_script(
            'aos-js',
            'https://unpkg.com/aos@2.3.1/dist/aos.js',
            array(),
            null,
            true
        );

        wp_add_inline_script('aos-js', 'AOS.init();');
    }

    public static function aos_animation_render_block($block_content, $block) 
    {
        if (!empty($block['attrs']['aosAnimation'])) {
            $animation = esc_attr($block['attrs']['aosAnimation']);
            // Versión corregida del regex
            return str_replace(
                'class="', 
                'data-aos="' . $animation . '" class="', 
                $block_content
            );
        }
        return $block_content;
    }

    public static function odiseia_enqueue_scripts() 
    {
        $options = get_option('odiseia', []);
        if(isset($options['odiseia_eneable_aos']) && $options['odiseia_eneable_aos']) {
            wp_enqueue_script(
                'odiseiaframework-aos',
                ODISEIAFRAMEWORK_URL.'build/Plugins/aos.js',
                ['wp-hooks', 'wp-blocks', 'wp-element'],
                '0.1.0',
                true); 
        }
    }
  

    /*
    ***
    ***
    *** FUNCTIONS THEME SUPORT */


    public static function odiseia_eneable_theme_support() 
    {
        add_theme_support( 'align-wide' );
    }

    
    /*
    ***
    ***
    *** FUNCTIONS CORE PLUGIN */

    private static function load_core_files() 
    {
   
    }

    private static function load_custom_files() 
    {
        $custom_dir = ODISEIAFRAMEWORK_PATH . 'core/';
        
        if ( is_dir( $custom_dir ) ) {
            foreach ( glob( $custom_dir . '*.php' ) as $file ) {
                require_once $file;
            }
        }
    }

}