import { InspectorControls } from '@wordpress/block-editor';
import { registerBlockStyle, unregisterBlockStyle } from '@wordpress/blocks';
import { PanelBody, RangeControl, TabPanel, ToggleControl } from '@wordpress/components';
import { createHigherOrderComponent } from '@wordpress/compose';
import { Children, cloneElement } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

/* Configuración responsiva para Columnas */
const addColumnsResponsiveControls = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        const { attributes, setAttributes, name } = props;

        if (name !== 'core/columns') return <BlockEdit {...props} />;

        return (
            <>
                <BlockEdit {...props} />
                <InspectorControls>
                    <PanelBody title={__('Responsive Settings')}>
                        <ToggleControl
                            label={__('Reverse on Mobile')}
                            checked={attributes.mobileReverse}
                            onChange={(val) => setAttributes({ mobileReverse: val })}
                        />
                    </PanelBody>
                </InspectorControls>
            </>
        );
    };
}, 'withColumnsResponsiveControls');

/* Configuración responsiva para Separador */
const addSeparatorResponsiveControls = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        const { attributes, setAttributes, name } = props;

        if (name !== 'core/separator') return <BlockEdit {...props} />;

        return (
            <>
                <BlockEdit {...props} />
                <InspectorControls>
                    <PanelBody title={__('Responsive Spacing')}>
                        <TabPanel
                            tabs={[
                                { name: 'desktop', title: 'Desktop' },
                                { name: 'tablet', title: 'Tablet' },
                                { name: 'mobile', title: 'Mobile' },
                            ]}
                        >
                            {(tab) => (
                                <>
                                    <RangeControl
                                        label={__('Height')}
                                        value={attributes[`${tab.name}Height`]}
                                        onChange={(val) => setAttributes({ [`${tab.name}Height`]: val })}
                                        min={1}
                                        max={100}
                                    />
                                    <RangeControl
                                        label={__('Margin Top')}
                                        value={attributes[`${tab.name}MarginTop`]}
                                        onChange={(val) => setAttributes({ [`${tab.name}MarginTop`]: val })}
                                        min={0}
                                        max={50}
                                    />
                                </>
                            )}
                        </TabPanel>
                    </PanelBody>
                </InspectorControls>
            </>
        );
    };
}, 'withSeparatorResponsiveControls');

/* Añadir atributos personalizados */
addFilter(
    'blocks.registerBlockType',
    'gutemberg-responsive/add-attributes',
    (settings, name) => {
        if (name === 'core/columns') {
            return {
                ...settings,
                attributes: {
                    ...settings.attributes,
                    mobileReverse: { type: 'boolean' }
                }
            };
        }

        if (name === 'core/separator') {
            return {
                ...settings,
                attributes: {
                    ...settings.attributes,
                    desktopHeight: { type: 'number' },
                    tabletHeight: { type: 'number' },
                    mobileHeight: { type: 'number' },
                    desktopMarginTop: { type: 'number' },
                    tabletMarginTop: { type: 'number' },
                    mobileMarginTop: { type: 'number' },
                }
            };
        }
        return settings;
    }
);

/* Aplicar HOCs */
addFilter(
    'editor.BlockEdit',
    'gutemberg-responsive/columns-controls',
    addColumnsResponsiveControls
);

addFilter(
    'editor.BlockEdit',
    'gutemberg-responsive/separator-controls',
    addSeparatorResponsiveControls
);

/* Modificar salida del bloque - PARTE ACTUALIZADA */
addFilter(
    'blocks.getSaveContent.extraProps',
    'gutemberg-responsive/add-props',
    (props, block, attributes) => {
        if (block.name === 'core/columns') {
            const mobileReverse = attributes.mobileReverse;

            const newProps = {
                ...props,
                'data-mobile-reverse': mobileReverse,
            };

            if (mobileReverse > 1) {
                newProps.children = Children.toArray(props.children)
                    ?.map((child, index) => (
                        cloneElement(child, {
                            style: {
                                ...(child.props?.style || {}),
                                '--column-order': index
                            }
                        })
                    )) ?? [];
            }

            return newProps;
        }

        if (block.name === 'core/separator') {
            return {
                ...props,
                style: {
                    '--desktop-height': attributes.desktopHeight ? `${attributes.desktopHeight}px` : undefined,
                    '--tablet-height': attributes.tabletHeight ? `${attributes.tabletHeight}px` : undefined,
                    '--mobile-height': attributes.mobileHeight ? `${attributes.mobileHeight}px` : undefined,
                    '--desktop-margin': attributes.desktopMarginTop ? `${attributes.desktopMarginTop}px` : undefined,
                    '--tablet-margin': attributes.tabletMarginTop ? `${attributes.tabletMarginTop}px` : undefined,
                    '--mobile-margin': attributes.mobileMarginTop ? `${attributes.mobileMarginTop}px` : undefined,
                }
            };
        }
        return props;
    }
);
