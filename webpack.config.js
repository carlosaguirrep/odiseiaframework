/**
 * Webpack config for `wp-scripts build` and `wp-scripts start`.
 *
 * Extends the default @wordpress/scripts config instead of replacing it:
 * - Blocks: entry points are still auto-detected from every `block.json` in the source directory.
 * - Editor plugins: every `src/Plugins/*.js` file is added as an entry named `Plugins/{name}`,
 *   so it is emitted as `build/Plugins/{name}.js` with a `build/Plugins/{name}.asset.php` file.
 *
 * `wp-scripts` sets the mode (production for `build`, development for `start`) and exposes the
 * CLI flags (`--webpack-copy-php`, `--webpack-src-dir`) to the default config through env vars.
 */
const { existsSync, readdirSync } = require( 'fs' );
const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const PLUGINS_DIR = 'Plugins';

const getEditorPluginEntries = () => {
	const pluginsPath = path.resolve(
		__dirname,
		process.env.WP_SOURCE_PATH || 'src',
		PLUGINS_DIR
	);

	if ( ! existsSync( pluginsPath ) ) {
		return {};
	}

	return Object.fromEntries(
		readdirSync( pluginsPath, { withFileTypes: true } )
			.filter( ( file ) => file.isFile() && file.name.endsWith( '.js' ) )
			.map( ( file ) => [
				`${ PLUGINS_DIR }/${ path.basename( file.name, '.js' ) }`,
				path.join( pluginsPath, file.name ),
			] )
	);
};

const addEditorPluginEntries = ( config ) => ( {
	...config,
	// The default entry is a function; webpack evaluates it again on every watch rebuild.
	entry: async () => {
		const blockEntries =
			typeof config.entry === 'function'
				? await config.entry()
				: config.entry;

		return { ...blockEntries, ...getEditorPluginEntries() };
	},
} );

// With `--experimental-modules` the default config is an array (script build + module build).
// Editor plugins are classic scripts, so only the script build receives them.
module.exports = Array.isArray( defaultConfig )
	? defaultConfig.map( ( config ) =>
			config.output?.module ? config : addEditorPluginEntries( config )
	  )
	: addEditorPluginEntries( defaultConfig );
