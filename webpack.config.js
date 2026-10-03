/**
 * Webpack config for `wp-scripts build` and `wp-scripts start`.
 *
 * Extends the default @wordpress/scripts config instead of replacing it:
 * - Blocks: entry points are still auto-detected from every `block.json` in the source directory.
 * - Generated entries: every `.js` file directly inside `src/Plugins` or `src/Admin` is added as
 *   an entry named `{Dir}/{name}`, so it is emitted as `build/{Dir}/{name}.js` with a matching
 *   `build/{Dir}/{name}.asset.php` file. `Plugins` holds editor plugins (block editor sidebars,
 *   meta panels); `Admin` holds standalone admin page apps (e.g. the CPT Builder screen).
 *
 * `wp-scripts` sets the mode (production for `build`, development for `start`) and exposes the
 * CLI flags (`--webpack-copy-php`, `--webpack-src-dir`) to the default config through env vars.
 */
const { existsSync, readdirSync } = require( 'fs' );
const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const GENERATED_ENTRY_DIRS = [ 'Plugins', 'Admin' ];

const getDirEntries = ( dirName ) => {
	const dirPath = path.resolve(
		__dirname,
		process.env.WP_SOURCE_PATH || 'src',
		dirName
	);

	if ( ! existsSync( dirPath ) ) {
		return {};
	}

	return Object.fromEntries(
		readdirSync( dirPath, { withFileTypes: true } )
			.filter( ( file ) => file.isFile() && file.name.endsWith( '.js' ) )
			.map( ( file ) => [
				`${ dirName }/${ path.basename( file.name, '.js' ) }`,
				path.join( dirPath, file.name ),
			] )
	);
};

const getGeneratedEntries = () =>
	GENERATED_ENTRY_DIRS.reduce(
		( entries, dirName ) => ( { ...entries, ...getDirEntries( dirName ) } ),
		{}
	);

const addGeneratedEntries = ( config ) => ( {
	...config,
	// The default entry is a function; webpack evaluates it again on every watch rebuild.
	entry: async () => {
		const blockEntries =
			typeof config.entry === 'function'
				? await config.entry()
				: config.entry;

		return { ...blockEntries, ...getGeneratedEntries() };
	},
} );

// With `--experimental-modules` the default config is an array (script build + module build).
// Generated entries are classic scripts, so only the script build receives them.
module.exports = Array.isArray( defaultConfig )
	? defaultConfig.map( ( config ) =>
			config.output?.module ? config : addGeneratedEntries( config )
	  )
	: addGeneratedEntries( defaultConfig );
