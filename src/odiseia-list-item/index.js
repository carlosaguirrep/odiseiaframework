import { registerBlockType } from '@wordpress/blocks';
import meta from './block.json';
import Edit from './edit';
import Save from './save';

registerBlockType(meta.name, {
    edit: Edit,
    save: Save
});