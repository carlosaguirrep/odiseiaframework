import { InnerBlocks, useBlockProps, useSetting } from '@wordpress/block-editor';

const Edit = (props) => {
    const blockProps = useBlockProps(); // Obtén las props del bloque, incluyendo clases como alignwide
    const { attributes, setAttributes } = props;
    const defaultLayout = useSetting( 'layout' ) || {};
    return (
        <div {...blockProps}>
            <InnerBlocks
                allowedBlocks={['core/paragraph', 'core/heading', 'core/columns']}
                template={[
                    ['core/paragraph', { placeholder: 'Escribe aquí...' }],
                ]}
                renderAppender={() => <InnerBlocks.ButtonBlockAppender />}
                __experimentalLayout={ defaultLayout }
            />
        </div>
    );
};

export default Edit;  
