<?php 

namespace odiseIAFramework;

// HERE IS ALL THEME OPTIONS PAGE 

class Odiseia_Options 
{
    public static function init() 
    {
        add_action('admin_menu', [__CLASS__, 'odiseia_theme_options']);
        add_action('admin_init', [__CLASS__, 'odiseia_theme_options_fields']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'styles_for_theme_options']);
    }

    public static function odiseia_theme_options()
{
    add_menu_page(
        'OdiseIa Options', 
        'OdiseIa',
        'manage_options', 
        'odiseiaframework', 
        [__CLASS__, 'odiseia_theme_options_render_page'],
        'dashicons-admin-site', 
        99
    );
}


    public static function odiseia_theme_options_fields()
    {
        register_setting(
            'odiseiaFrameworkOptions', // Grupo de opciones
            'odiseia', // Nombre de la opción
            ['sanitize_callback' => [self::class, 'odiseia_sanitize_options']]
        );

        // Añadir una sección
        add_settings_section(
            'modules', 
            'Enable/Disable Modules', 
            [__CLASS__, 'odiseia_section_modules'], 
            'odiseiaframework'
        );

        add_settings_field(
            'odiseia_eneable_svg_support', 
            'Eneable SVG Support', 
            [__CLASS__, 'odiseia_switch_callback'], 
            'odiseiaframework', 
            'modules',
            ['option_name' => 'odiseia_eneable_svg_support']
        );

        // add_settings_field(
        //     'odiseia_cache_support', 
        //     'Eneable Cache Tools', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_cache_support']
        // );

        // Añadir un campo de opción
        add_settings_field(
            'odiseia_eneable_aos', 
            'Eneable AOS Scripts', 
            [__CLASS__, 'odiseia_switch_callback'], 
            'odiseiaframework', 
            'modules',
            ['option_name' => 'odiseia_eneable_aos']
        );

        add_settings_field(
            'odiseia_eneable_seo', 
            'Eneable IA SEO Tools', 
            [__CLASS__, 'odiseia_switch_callback'], 
            'odiseiaframework', 
            'modules',
            [
                'option_name' => 'odiseia_eneable_seo',
                'description' => sprintf(
                    /* translators: %s: Link to the Settings > Connectors screen. */
                    __('Uses the AI provider configured in %s.', 'odiseiaframework'),
                    '<a href="' . esc_url(admin_url('options-connectors.php')) . '">' . esc_html__('Settings > Connectors', 'odiseiaframework') . '</a>'
                ),
            ]
        );

        add_settings_field(
            'odiseia_enable_content_generator', 
            'Eneable DeepSeek Content Generator', 
            [__CLASS__, 'odiseia_switch_callback'], 
            'odiseiaframework', 
            'modules',
            ['option_name' => 'odiseia_enable_content_generator'] 
        );

        add_settings_field(
            'odiseia_enable_image_generator', 
            'Eneable Midjurney Image Generator', 
            [__CLASS__, 'odiseia_switch_callback'], 
            'odiseiaframework', 
            'modules',
            ['option_name' => 'odiseia_enable_image_generator'] 
        );

        // add_settings_field(
        //     'odiseia_enable_google_maps_tools', 
        //     'Eneable Google Maps Tools', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_enable_google_maps_tools'] 
        // );

        // add_settings_field(
        //     'odiseia_enable_hubspot_tools', 
        //     'Eneable HubSpot Tools', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_switch_callback'] 
        // );
        
        // add_settings_field(
        //     'odiseia_enable_mailchimp_tools', 
        //     'Eneable MailChimp Tools', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_enable_mailchimp_tools'] 
        // );
        
        // add_settings_field(
        //     'odiseia_enable_cronjobs_tools', 
        //     'Config WP CronJobs', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_enable_cronjobs_tools']
        // );


        // add_settings_field(
        //     'odiseia_image_optimizer', 
        //     'Image Optimizer', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_image_optimizer']
        // );


        // add_settings_field(
        //     'odiseia_cloud_storage', 
        //     'Cloud Storage', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_cloud_storage']
        // );

        // add_settings_field(
        //     'odiseia_hls_player', 
        //     'HLS Player', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_hls_player']
        // );


        // add_settings_field(
        //     'odiseia_cpt_creator', 
        //     'CPT Creator', 
        //     [__CLASS__, 'odiseia_switch_callback'], 
        //     'odiseiaframework', 
        //     'modules',
        //     ['option_name' => 'odiseia_cpt_creator']
        // );


    }

    public static function odiseia_section_modules()
    {   
        echo '<p>Eneable PowerFull tools for your FSE</p>';
    }

    public static function odiseia_input_callback()
    {
        $options = get_option('odiseia', []); // Asegura que al menos sea un array vacío
        $value = isset($options['enable_aos']) ? esc_attr($options['enable_aos']) : '';
        ?>
        <input type="text" name="odiseia[enable_aos]" value="<?php echo $value; ?>">
        <?php
    }

    public static function odiseia_switch_callback($args)
    {
        $options = get_option('odiseia', []);
        $option_name = $args['option_name'];
        $checked = isset($options[$option_name]) && $options[$option_name] ? 'checked' : '';
        ?>
        <label class="switch">
            <input type="checkbox" 
                   class="switch-input" 
                   name="odiseia[<?php echo esc_attr($option_name); ?>]" 
                   <?php echo $checked; ?>>
            <span class="switch-slider"></span>
        </label>
        <?php
        if (! empty($args['description'])) {
            echo '<p class="description">' . wp_kses_post($args['description']) . '</p>';
        }
    }

    /**
     * Option keys rendered as switches on the options page.
     *
     * These keys are already stored on existing sites, so they must not be renamed
     * (including the historical "eneable" spelling).
     */
    const TOGGLE_OPTIONS = [
        'odiseia_eneable_svg_support',
        'odiseia_eneable_aos',
        'odiseia_eneable_seo',
        'odiseia_enable_content_generator',
        'odiseia_enable_image_generator',
    ];

    /**
     * Sanitizes the `odiseia` option array.
     *
     * Unchecked checkboxes are not submitted, so every known toggle is forced to 0/1.
     *
     * @param mixed $input Submitted option value (null when every switch is unchecked).
     * @return array<string, int>
     */
    public static function odiseia_sanitize_options($input)
    {
        $input     = is_array($input) ? $input : [];
        $sanitized = [];

        foreach (self::TOGGLE_OPTIONS as $option_name) {
            $sanitized[$option_name] = empty($input[$option_name]) ? 0 : 1;
        }

        return $sanitized;
    }


    public static function odiseia_theme_options_render_page() 
    {
        $template_path = ODISEIAFRAMEWORK_PATH . 'templates/odiseia_options.php';
    
        if (file_exists($template_path)) {
            include $template_path;
        } else {
            echo '<div class="error"><p>¡Error: No se encontró la plantilla!</p></div>';
        }
    }

    public static function styles_for_theme_options() 
    {
        wp_register_style('odiseia_options', ODISEIAFRAMEWORK_URL . 'assets/odiseia_options/style.css', false, '0.1.0');
        wp_enqueue_style('odiseia_options');

        wp_register_script( 'odiseia_options', ODISEIAFRAMEWORK_URL. 'assets/odiseia_options/scripts.js', false, '0.1.0', true );
        wp_enqueue_script( 'odiseia_options' );
    }
}
