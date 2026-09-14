import { useBlockProps } from '@wordpress/block-editor';
import { InnerBlocks } from '@wordpress/block-editor';

export default function Edit() {
    const ALLOWED_BLOCKS = ['odiseiaframework/odiseia-list-item'];

    return (
        <div {...useBlockProps()}>
            <ul className="odiseia-list">
                <InnerBlocks allowedBlocks={ALLOWED_BLOCKS} />
            </ul>
        </div>
    );
}
