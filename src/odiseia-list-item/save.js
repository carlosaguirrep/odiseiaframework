import { useBlockProps } from '@wordpress/block-editor';
const { InnerBlocks } = wp.blockEditor;

export default function Save({ attributes }) {
    return (
        <li {...useBlockProps.save()}>
            <div className='number'>
                <span>{attributes.index}</span> {/* Usa el número guardado */}
            </div>
            <div className="list-content">
                <InnerBlocks.Content />
            </div>
        </li>
    );
}
