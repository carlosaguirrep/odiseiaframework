import { useBlockProps } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';

const { InnerBlocks } = wp.blockEditor;

export default function Edit({ attributes, setAttributes, clientId }) {
    const ALLOWED_BLOCKS = ['core/heading', 'core/paragraph'];

    // Obtener el índice del bloque dentro del bloque padre
    const index = useSelect((select) => {
        const { getBlockIndex, getBlockRootClientId } = select('core/block-editor');
        const rootClientId = getBlockRootClientId(clientId);
        return getBlockIndex(clientId, rootClientId) + 1;
    }, [clientId]);

    // Guardar el índice en los atributos cuando cambia
    if (attributes.index !== index) {
        setAttributes({ index });
    }

    return (
        <li {...useBlockProps()}>
            <div className='number'>
                <span>{attributes.index}</span>
            </div>
            <div className="list-content">
                <InnerBlocks 
                    allowedBlocks={ALLOWED_BLOCKS}
                    template={[
                        ['core/heading', { placeholder: 'Escribe el título aquí', level: 3 }],
                        ['core/paragraph', { placeholder: 'Escribe el texto aquí' }],
                    ]}
                    templateLock="all"
                />
            </div>
        </li>
    );
}
