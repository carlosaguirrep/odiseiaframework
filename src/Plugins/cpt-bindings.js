/**
 * WordPress dependencies
 */
import { registerBlockBindingsSource } from '@wordpress/blocks';
import { store as coreStore } from '@wordpress/core-data';

const BINDING_SOURCE_NAME = 'odiseia/attachment';

/**
 * Client-side counterpart of Image_Binding::register_source() (PHP): lets the EDITOR preview an
 * image field's bound `url`/`alt` while editing a Query Loop template, instead of showing the
 * static placeholder until the page is saved and reloaded. Read-only — editing happens through
 * the "CPT Fields" panel (cpt-fields.js), or the image field's own meta, not inline on the bound attribute
 * — simply because this source defines no `setValues` callback; the block editor only allows
 * editing a bound attribute when a source provides one. Lives in its own entry, separate from the panel
 * script, because Query Loop variations are inserted in pages, posts and the Site Editor, where
 * the panel script is not enqueued. Intentionally silent (returns {})
 * whenever the attachment or its entity record is not yet available, so a transient resolver
 * miss never throws.
 */
registerBlockBindingsSource({
    name: BINDING_SOURCE_NAME,
    usesContext: ['postId', 'postType'],
    getValues({ select, context, bindings }) {
        const values = {};
        const { postId, postType } = context || {};
        if (!postId || !postType) {
            return values;
        }

        const record = select(coreStore).getEntityRecord('postType', postType, postId);
        const meta = record && record.meta ? record.meta : {};

        Object.entries(bindings).forEach(([attributeName, binding]) => {
            const key = binding && binding.args ? binding.args.key : undefined;
            const attachmentId = key ? parseInt(meta[key], 10) : 0;
            if (!attachmentId) {
                return;
            }

            // getMedia() was deprecated in favor of the generic entity-record selector and is
            // gone entirely from the core-data bundled with this WordPress version (confirmed:
            // no longer present in wp-includes/js/dist/core-data.js) — calling it here would
            // throw. Same underlying REST resource (wp/v2/media), accessed as the `attachment`
            // post type entity instead.
            const attachment = select(coreStore).getEntityRecord('postType', 'attachment', attachmentId);
            if (!attachment) {
                return;
            }

            if ('url' === attributeName) {
                values.url = attachment.source_url;
            } else if ('alt' === attributeName) {
                values.alt = attachment.alt_text;
            }
        });

        return values;
    },
});
