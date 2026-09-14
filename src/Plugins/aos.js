import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl } from '@wordpress/components';
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';

// Bloques a los que agregar la animación
const allowedBlocks = [
    'core/group',
    'core/columns',
    'core/cover',
    // Agrega aquí otros bloques
];

// Agregar atributo a los bloques
addFilter(
    'blocks.registerBlockType',
    'aos-animation/attributes',
    (settings, name) => {
        if (allowedBlocks.includes(name)) {
            settings.attributes = {
                ...settings.attributes,
                aosAnimation: {
                    type: 'string',
                    default: '',
                },
            };
        }
        return settings;
    }
);

// Agregar control en el Inspector
const withAOSControl = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        if (!allowedBlocks.includes(props.name)) {
            return <BlockEdit {...props} />;
        }

        const { attributes, setAttributes } = props;
        const { aosAnimation } = attributes;

        const animationOptions = [
            { label: 'Sin animación', value: '' },
            { label: 'Fade', value: 'fade' },
            { label: 'Fade Up', value: 'fade-up' },
            { label: 'Fade Down', value: 'fade-down' },
            { label: 'Fade Right', value: 'fade-right'},
            { label: 'Fade Left', value: 'fade-left'},
            { label: 'Fade Up Right', value: 'fade-up-right'},
            { label: 'Fade Up Left', value: 'fade-up-left'},
            { label: 'Zoom', value: 'zoom' },
            { label: 'Slide Up', value: 'slide-up' },

            // Agrega todas las animaciones de AOS aquí
        ];

        return (
            <>
                <BlockEdit {...props} />
                <InspectorControls>
                    <PanelBody title="Animaciones AOS">
                        <SelectControl
                            label="Seleccionar animación"
                            value={aosAnimation}
                            options={animationOptions}
                            onChange={(value) => setAttributes({ aosAnimation: value })}
                        />
                    </PanelBody>
                </InspectorControls>
            </>
        );
    };
}, 'withAOSControl');

addFilter(
    'editor.BlockEdit',
    'aos-animation/controls',
    withAOSControl
);

