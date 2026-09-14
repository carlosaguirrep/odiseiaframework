<?php

namespace odiseIAFramework;

/**
 * Helpers for scripts built from `src/Plugins` by `wp-scripts`.
 */
class Assets
{
    /**
     * Enqueues an editor plugin script built as `build/Plugins/{name}.js`.
     *
     * Dependencies and version are read from the `build/Plugins/{name}.asset.php` file that
     * `wp-scripts` generates from the script's `@wordpress/*` imports. When the asset file is
     * missing or invalid (for example, the build has not run), nothing is enqueued.
     *
     * @param string   $handle     Script handle.
     * @param string   $name       Entry name inside `build/Plugins`, without extension.
     * @param string[] $extra_deps Additional handles that cannot be detected from imports.
     * @return bool Whether the script was enqueued.
     */
    public static function enqueue_plugin_script($handle, $name, array $extra_deps = [])
    {
        $asset_path = ODISEIAFRAMEWORK_PATH . 'build/Plugins/' . $name . '.asset.php';
        if (! is_readable($asset_path)) {
            return false;
        }

        $asset = require $asset_path;
        if (! is_array($asset)) {
            return false;
        }

        $dependencies = isset($asset['dependencies']) && is_array($asset['dependencies']) ? $asset['dependencies'] : [];
        $version      = isset($asset['version']) ? (string) $asset['version'] : false;

        wp_enqueue_script(
            $handle,
            ODISEIAFRAMEWORK_URL . 'build/Plugins/' . $name . '.js',
            array_values(array_unique(array_merge($dependencies, $extra_deps))),
            $version,
            true
        );

        return true;
    }
}
