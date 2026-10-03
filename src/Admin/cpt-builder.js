/**
 * Webpack entry for the CPT Builder admin page (see Admin_Page::render_page() in
 * includes/cpt_builder/admin_page.php and Admin_Page::BUNDLE_ENTRY), built to
 * build/Admin/cpt-builder.js by the generated-entries pass in webpack.config.js.
 */

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import App from './cpt-builder/App';

const root = document.getElementById('odiseia-cpt-builder-root');

if (root) {
    createRoot(root).render(<App />);
}
