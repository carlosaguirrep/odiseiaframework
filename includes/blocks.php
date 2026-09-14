<?php
namespace odiseIAFramework;

// HERE WE CAN REGISTER ALL CUSTOM BLOCKS FOR FUCIONALITIES

class Blocks 
{

    public static function init(){
        self::register_block_types();
        self::odiseia_blocks();
    }

    public static function  register_block_types(){
        add_action('init', [__CLASS__, 'odiseia_blocks']);
        add_action('admin_menu', [self::class,'block_gallery']);
    }

    public static function odiseia_blocks(){
        register_block_type(  ODISEIAFRAMEWORK_PATH . '/build/odiseia-hero' );
        register_block_type(  ODISEIAFRAMEWORK_PATH . '/build/odiseia-list' );
        register_block_type(  ODISEIAFRAMEWORK_PATH . '/build/odiseia-list-item' );
        register_block_type(  ODISEIAFRAMEWORK_PATH . '/build/wallpaper-fixed' );
    }

    public static function block_gallery(){
        add_menu_page( 'odiseiablocks', 'OdiseIa Blocks', 'manage_options', 'odiseiablocks', [__CLASS__,'odiseia_gallery_render_page'] );
    }
    

    public static function odiseia_gallery_render_page()
    {
        $template_path = ODISEIAFRAMEWORK_PATH . 'templates/odiseia_gallery.php';
    
        if (file_exists($template_path)) {
            include $template_path;
        } else {
            echo '<div class="error"><p>¡Error: No se encontró la plantilla!</p></div>';
        }
    }

   

}