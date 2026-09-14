# OdiseIaFramework

OdiseIaFramework is a WordPress plugin for building Gutenberg sites. It rests on two pillars:

- **A block library**: custom Gutenberg blocks plus editor extensions for core blocks. The goal is to let site owners browse a gallery in wp-admin and enable or disable blocks as they need them (see [Roadmap](#roadmap) for current status).
- **AI features through WordPress core**: AI-assisted SEO that uses the WordPress AI Client. No API key is stored or managed by the plugin itself.

## Quick start

1. Place the plugin in `wp-content/plugins/odiseiaframework`.
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Activate **OdiseIaFramework** in **Plugins**.
4. Optional: set up an AI provider ([AI setup](#ai-setup)) and turn on AI SEO in the plugin options page.

## Features

### Block library

| Block | Name | What it does |
|-------|------|--------------|
| OdiseIA Hero | `odiseiaframework/odiseia-hero` | Container that accepts paragraphs, headings, and columns. Supports wide/full alignment, background color and image, and spacing. |
| OdiseIa List | `odiseiaframework/odiseia-list` | `<ul>` wrapper that accepts only OdiseIa List Element blocks. |
| OdiseIa List Element | `odiseiaframework/odiseia-list-item` | Auto-numbered list item with a locked heading and paragraph template. |
| Wallpaper Fixed | `odiseiaframework/wallpaper-fixed` | Full-viewport, fixed background layer with color and gradient support. |

All four blocks are registered on every request from `build/` by `Blocks::odiseia_blocks()` in `includes/blocks.php`.

**Block gallery (work in progress).** The plugin adds an **OdiseIa Blocks** menu page in wp-admin (capability `manage_options`).

| Gallery capability | Current status |
|--------------------|----------------|
| Admin page | Available. Renders `templates/odiseia_gallery.php`. |
| Block cards, **Preview**, and **Import** buttons | Static placeholder markup only. The buttons do nothing yet. |
| Preview modal | Empty container, not wired. |
| Enable/disable individual blocks | Not implemented. Every bundled block is always registered. |

### Editor and site extensions

The plugin stores its options in the `odiseia` option (an array). Option keys use the spelling `eneable`, as in the code.

| Extension | Enabled by | What it does |
|-----------|------------|--------------|
| AOS animations | `odiseia['odiseia_eneable_aos']` | Adds an animation selector to Group, Columns, and Cover blocks. On render it adds a `data-aos` attribute and loads AOS 2.3.1 from `unpkg.com`. |
| SVG uploads | `odiseia['odiseia_eneable_svg_support']` | Allows `.svg` in the Media Library. SVG files are **not sanitized**, so enable this only when every uploader is trusted. |
| Wide alignment | Always on | Calls `add_theme_support( 'align-wide' )`. |
| Responsive controls | Always enqueued | In progress. See [Roadmap](#roadmap). |
| Custom PHP loader | Always on | Loads every `core/*.php` file on `init`. Use it for site-specific code. The `core/` directory is git-ignored. |

### AI SEO

Enable it with the AI SEO toggle in the plugin options page (`odiseia['odiseia_eneable_seo']`). It adds:

- A sidebar panel for **meta title**, **meta description**, and **keywords** on posts and pages, in the post editor and when editing pages in the Site Editor. Change the post types with the `odiseia_seo_post_types` filter. Only post types that support `custom-fields` are kept.
- Storage in post meta: `_meta_title`, `_meta_description`, `_meta_keywords`.
- Output of the description and keywords as `<meta>` tags in `<head>`.
- The meta title replaces the **complete** document title (`<title>`), with no site name appended. When it is empty, WordPress uses its default title.
- An **Analyze** button that sends the content to the AI provider. It returns a rating of the current full title, complete title suggestions (up to 60 characters), keywords, and a meta description.

| REST endpoint | Value |
|---------------|-------|
| Route | `POST /wp-json/odiseia-seo-tool/v1/analyze-content` |
| Required capability | `edit_posts` |
| Success response | `{ rating, suggestions, keywords, description }` |
| AI unavailable or no provider configured | HTTP `503` |

The endpoint uses `wp_ai_client_prompt()` from the WordPress core AI Client.

## Requirements

| Component | Version |
|-----------|---------|
| WordPress | 7.0 or later |
| PHP | 7.4 or later |
| Node.js / npm (build only) | Node 18.12+ / npm 8.19.2+ (required by `@wordpress/scripts` 30) |
| AI provider plugin (AI SEO only) | See [AI setup](#ai-setup) |

## Installation

For development:

```bash
cd wp-content/plugins/odiseiaframework
npm install
npm run build
```

Then activate the plugin in **Plugins**. The plugin loads blocks and editor scripts from `build/`, so the build must run before activation.

To produce a distributable archive:

```bash
npm run plugin-zip
```

## AI setup

AI SEO uses the AI Client in WordPress core. Credentials are managed by WordPress, not by this plugin.

1. **Install and activate a provider plugin.**

   | Provider | Plugin slug | Key name |
   |----------|-------------|----------|
   | OpenAI | `ai-provider-for-openai` | `OPENAI_API_KEY` |
   | Anthropic | `ai-provider-for-anthropic` | `ANTHROPIC_API_KEY` |
   | Google | `ai-provider-for-google` | `GOOGLE_API_KEY` |

2. **Provide the API key** in one of three ways. WordPress checks them in this order:

   1. Environment variable, for example `OPENAI_API_KEY`.
   2. Constant in `wp-config.php`:
      ```php
      define( 'OPENAI_API_KEY', 'your-key' );
      ```
   3. Database, set in **Settings → Connectors**.

   Prefer the environment variable or the constant. They keep the key out of the database and out of database backups.

3. **Turn on AI SEO** in the plugin options page.
4. **Verify.** Open a post, open the SEO panel in the sidebar, and click **Analyze**. An HTTP `503` means no provider is available or configured.

## Development

### Scripts

| Script | What it does |
|--------|--------------|
| `npm run build` | Production build (minified, no source maps) of everything in `src/` into `build/` with `@wordpress/scripts`: blocks and editor plugins. PHP files are copied (`--webpack-copy-php`). |
| `npm run start` | Development build of the same entries in watch mode (unminified, with source maps). |
| `npm run build:all` | Alias of `build`. |
| `npm run start:all` | Alias of `start`. |
| `npm run add-block -- <name>` | Scaffolds a new block in `src/<name>/`. See [Adding a block](#adding-a-block). |
| `npm run lint:js` | Lints JavaScript. |
| `npm run lint:css` | Lints styles. |
| `npm run format` | Formats code. |
| `npm run packages-update` | Updates `@wordpress/*` packages. |
| `npm run plugin-zip` | Creates a plugin `.zip`. |

Both builds come from one toolchain: `webpack.config.js` extends the default `@wordpress/scripts` config. Block entry points are detected from each `block.json`, and every `src/Plugins/*.js` file is added as an entry that outputs `build/Plugins/{name}.js` plus `build/Plugins/{name}.asset.php`. The PHP side reads the dependencies and version for each editor script from its `.asset.php` file. If that file is missing, the script is not enqueued. Editor plugins must import `@wordpress/*` packages instead of using `wp.*` globals, because dependency detection only sees imports.

> **Always run `npm run build` before committing.** `build/` is committed, and `npm run start` writes development output (unminified, with source maps) into it.

### Project structure

```text
odiseiaframework/
├── odiseiaframework.php    # Plugin header, constants, bootstrap on `init`
├── includes/
│   ├── autoloader.php      # Autoloader for the odiseIAFramework namespace
│   ├── blocks.php          # Blocks: block registration and the OdiseIa Blocks page
│   ├── config.php          # Config: option-driven features, theme support, core/ loader
│   ├── ponder.php          # Ponder: extensions for core blocks (responsive assets)
│   ├── odiseia_options.php # Odiseia_Options: plugin options page
│   └── ia_features/
│       └── seo.php         # Seo: AI SEO meta fields and REST endpoint
├── src/
│   ├── odiseia-hero/       # One folder per block (block.json, edit.js, save.js, ...)
│   ├── odiseia-list/
│   ├── odiseia-list-item/
│   ├── wallpaper-fixed/
│   └── Plugins/            # Editor extensions (seo.js, aos.js, responsive*.js)
├── build/                  # Compiled output (generated)
├── templates/              # Admin page templates (options, gallery)
├── assets/                 # Admin styles/scripts, front-end CSS, logo
├── core/                   # Optional site-specific PHP, auto-loaded, git-ignored
├── create-block.js         # Block scaffolding script
└── webpack.config.js       # Extends the @wordpress/scripts config with src/Plugins entries
```

### How the PHP side loads

`odiseiaframework.php` defines `ODISEIAFRAMEWORK_PATH` and `ODISEIAFRAMEWORK_URL`, then requires `includes/autoloader.php`. On `init` it calls:

| Class | Responsibility |
|-------|----------------|
| `IA_features\Seo` | AI SEO feature. |
| `Blocks` | Registers the bundled blocks and adds the OdiseIa Blocks admin page. |
| `Config` | Reads the `odiseia` option. Enables SVG uploads and AOS when toggled, adds `align-wide` support, and loads `core/*.php`. |
| `Ponder` | Extends core blocks. It enqueues `build/Plugins/responsive.js` in the editor and `assets/responsive.css` on the editor and front end. |
| `Odiseia_Options` | Plugin options page. |

The autoloader maps `odiseIAFramework\Some\Class_Name` to `includes/some/class_name.php`. It removes the namespace prefix, turns `\` into `/`, and lowercases the whole path. New classes must follow that file naming.

### Adding a block

1. Scaffold the block. Use a lowercase, hyphenated name, because the script does not normalize case.
   ```bash
   npm run add-block -- my-block
   ```
   This creates `src/my-block/` with `block.json`, `index.js`, `edit.js`, `save.js`, `view.js`, `render.php`, `style.css`, and `editor.css`.

2. Review the generated files before building:
   - [ ] Add `"apiVersion": 3` and `"editorScript": "file:./index.js"` to `block.json`. Without `editorScript`, `wp-scripts` does not build the block's JavaScript.
   - [ ] Fix or delete `render.php`. `block.json` does not reference it, and its function name is not valid PHP for hyphenated names.
   - [ ] Fix `style.css`, which contains Sass syntax. Rename it to `.scss` or remove the variable, then reference or import it.

3. Register the block in `Blocks::odiseia_blocks()` (`includes/blocks.php`):
   ```php
   register_block_type( ODISEIAFRAMEWORK_PATH . 'build/my-block' );
   ```

4. Build and check the block in the editor inserter:
   ```bash
   npm run build
   ```

## Roadmap

### Block library gallery

Goal: site owners open the gallery in wp-admin and install or uninstall (enable or disable) blocks as they please.

- [x] Admin menu page **OdiseIa Blocks** with a gallery layout
- [ ] List available blocks from their `block.json` metadata instead of placeholder cards
- [ ] Block thumbnails and a working preview modal
- [ ] Enable/disable action per block, saved in the database
- [ ] Register only enabled blocks, replacing the hard-coded list in `Blocks::odiseia_blocks()`

### Also in progress

- [ ] Responsive controls for core blocks. `src/Plugins/responsive.js` is empty. `responsiveSpacing.js` is built but not enqueued (the enqueue call is commented out in `includes/ponder.php`). `testresponsive.js` is a prototype for Columns and Separator, and is built but not enqueued.
- [ ] Make `add-block` output build-ready and auto-registered (see the checklist in [Adding a block](#adding-a-block)).

## License

GPL-2.0-or-later. Author: Carlos Aguirre.
