import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import Save from './save';
import meta from './block.json';

import './style.scss';

registerBlockType(meta.name, {
    edit: Edit,
    save: Save
});