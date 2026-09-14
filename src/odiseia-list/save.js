import { useBlockProps } from '@wordpress/block-editor';
import { InnerBlocks } from '@wordpress/block-editor';

export default function Save() {
    return (
        <div {...useBlockProps.save()}>
            <ul className="odiseia-list">
                <InnerBlocks.Content />
            </ul>
        </div>
    );
}
