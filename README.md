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

- A sidebar panel for **meta title**, **meta description**, and **focus keyword**, in the post editor and when editing pages in the Site Editor.
- Support for every public post type shown in the REST API (`public` and `show_in_rest`), including custom post types, except attachments. See [Supported post types](#supported-post-types).
- Storage in post meta: `_meta_title`, `_meta_description`, `_meta_focus_keyword`.
- Output of the description as a `<meta name="description">` tag in `<head>` on single views of the supported post types, the static front page, and the page set as **Posts page**. The focus keyword is never output, and no keywords meta tag is output (see the note in [SEO checks](#seo-checks)).
- The meta title replaces the **complete** document title (`<title>`), with no site name appended. On paginated content (`<!--nextpage-->` posts or later pages of the Posts page), the WordPress page number is kept: `Meta title – Page 2`. When the meta title is empty, WordPress uses its default title.
- An **Analyze** button that sends the content to the AI provider. It returns a rating of the current full title, complete title suggestions (up to 60 characters), 3 to 5 suggested focus keyphrases (realistic search phrases, most relevant first), and a meta description. Clicking a suggested keyphrase sets it as the **Focus keyword**, and the [SEO checks](#seo-checks) update immediately. The suggestion that matches the current focus keyword, ignoring case, accents, and quote style, is shown as selected; clicking it again clears the focus keyword. Suggestions that differ only in case, accents, or quote style are shown once.

| REST endpoint | Value |
|---------------|-------|
| Route | `POST /wp-json/odiseia-seo-tool/v1/analyze-content` |
| Required capability | `edit_posts` |
| Success response | `{ rating, suggestions, focus_keyphrases, description }` (`focus_keyphrases`: up to 5 strings) |
| AI unavailable or no provider configured | HTTP `503` |

The endpoint uses `wp_ai_client_prompt()` from the WordPress core AI Client.

#### SEO checks

The **SEO checks** section at the bottom of the sidebar scores the content from 0 to 100 while you edit. It uses no AI: every check runs in the browser on the SEO fields, the URL slug, and the blocks, and updates as they change.

- **Focus keyword** (`_meta_focus_keyword`): the main search phrase the content should rank for. Only these checks use it. It is not output on the page and not sent to the AI provider. Matching ignores case, accents, and typographic quotes (`’` matches `'`), and looks for the whole phrase.
- **Score**: each applicable check counts 1 when it passes, 0.5 for a warning, and 0 for a problem. Checks that do not apply, such as image alt text when there are no images, are left out. **Good** is 80 or more, **Needs improvement** 50 to 79, and **Poor** below 50.

| # | Check | Applies when | Passes when | Otherwise |
|---|-------|--------------|-------------|-----------|
| 1 | Meta title set | Always | Set | Warning: the default title is used |
| 2 | Title length | Always. Uses the meta title, or the default title | 30 to 60 characters | Warning: under 30 could be more descriptive, over 60 may be truncated in search results |
| 3 | Meta description set | Always | Set | Warning: search engines pick a snippet from the page |
| 4 | Meta description length | Description set | 70 to 160 characters | Warning: may be too short to summarize the page, or truncated in search results |
| – | Focus keyword set | No focus keyword | – | Warning. Replaces checks 5 to 9 |
| 5 | Keyword in title | Keyword set | Found | Warning |
| 6 | Keyword in meta description | Keyword and description set | Found | Warning |
| 7 | Keyword in URL slug | Keyword set, the permalink structure includes the slug, and the page is not the static front page | Found, using the slug WordPress creates for the keyword: generic transliteration (`Müller Straße` → `muller-strase`) or the German, Danish, and Serbian/Bosnian rules (`mueller-strasse`) | Warning |
| 8 | Keyword in a heading | Keyword set and the content has headings | Found | Warning |
| 9 | Keyword in content | Keyword set | Found | Problem |
| 10 | Readable URL slug | The permalink structure includes the slug, and the page is not the static front page | The slug has a word: letters, optionally with digits (`mp3`, `iphone15`), at least two characters unless non-Latin (`猫`) | Warning for numeric (`123`), placeholder (`post-123`, `untitled-2`, `auto-draft`), or hash-like (`a1b2c3d4e5f6a7b8`) slugs. Information (not scored) when no slug is set yet |
| 11 | Headings in long content | 5 or more non-empty paragraphs | At least one heading | Warning |
| 12 | Image alt text | The content has images | Every image has alt text | Warning with the number of images missing it |
| 13 | Descriptive link text | The content has links, including Buttons and linked images (their alt text is the link text) | No link text is empty or generic | Warning with the number of links, for text such as "click here", "read more", "aquí", or "leer más" |

Every check is based on Google's [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide). By design, there are no checks for keyword density, word count or content length, the number or order of headings, a single H1, or meta keywords, because the guide says they do not matter for Google Search. The length checks are about truncation in search results, not ranking.

Content is read from block attributes: rich text in any block, Image, Media & Text, Cover (when it renders an `<img>`), Button, and the HTML of Classic and Custom HTML blocks. The content of synced patterns, the output of server-rendered blocks, and text that third-party blocks store outside HTML attributes are not analyzed.

> **Note:** According to the Starter Guide, Google Search doesn't use the keywords meta tag, so the plugin has no Meta Keywords field and outputs no `<meta name="keywords">` tag. Values saved in `_meta_keywords` by earlier versions are left in the database untouched and unused: the key is no longer registered, revisioned, or exposed in the REST API.

#### Supported post types

By default, AI SEO covers every post type registered with `public` and `show_in_rest` set to `true`, except `attachment`. Custom post types are included automatically, at any `init` priority. The same list controls meta registration, the editor sidebar, and the front-end output.

Narrow or extend the list with the `odiseia_seo_post_types` filter. Add the filter before `init` finishes: the list is computed once per request.

```php
add_filter( 'odiseia_seo_post_types', function ( $post_types ) {
	return array_values( array_diff( $post_types, array( 'product' ) ) );
} );
```

WordPress only exposes post meta in the REST API for post types that support `custom-fields`. AI SEO adds that support to listed post types that lack it, so the editor can save the SEO fields. Side effects for those post types:

- **Block editor**: a **Custom fields** option appears in the editor **Preferences**. It follows each user's existing "Custom fields" preference (the `enable_custom_fields` user meta, shared across all post types), so it stays off unless that user has turned it on.
- **Classic editing screens** (post types without `editor` support, or with the block editor disabled): the legacy **Custom Fields** meta box is registered. It is hidden by default and can be shown from **Screen Options**. It does not list the SEO keys, which are protected.
- **REST API**: responses include a `meta` field. It also exposes any other plugin's meta registered for all post types with `show_in_rest`.

For post types that support `revisions`, the SEO fields are revisioned:

- **Preview of a published post** shows unsaved SEO changes when the post type supports both `revisions` and `autosave`. Otherwise it shows the saved SEO values.
- **Drafts**: **Preview** and **Save draft** run a full save, so SEO changes are saved. The periodic autosave of a draft does not store the SEO values.
- **Restoring a revision**, from the block editor's revisions view or the classic **Revisions** screen, restores the SEO values stored in that revision, including empty ones: clearing a field saves an empty value, which later revisions store and which is restored as empty. A revision stores no SEO value for a field that had never been set when the revision was saved, or when the revision was saved before the SEO fields were revisioned. Restoring it keeps the current value of that field.
- **Comparing revisions** in the block editor: an SEO field that a revision does not store shows the post's current value instead of an empty value, so the comparison reflects what restoring that revision would keep.

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
| `npm run test:unit` | Runs the JavaScript unit tests with Jest through `@wordpress/scripts`, such as the SEO check tests in `src/Plugins/seo/test/`. |
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
│       └── seo/            # SEO helpers imported by seo.js (checks, content analysis, tests); not entries
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
