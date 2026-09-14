import { InspectorControls, __experimentalBoxControl as BoxControl } from '@wordpress/block-editor';
import { Button, Icon, PanelBody, RangeControl, TabPanel } from '@wordpress/components';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useState } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

// Iconos de dispositivos
const devices = {
    desktop: <Icon icon="desktop" />,
    tablet: <Icon icon="tablet" />,
    mobile: <Icon icon="smartphone" />,
};

const withResponsiveControls = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        const { attributes, setAttributes, name } = props;
        const [currentDevice, setCurrentDevice] = useState('desktop');

        // Solo aplicar a bloques que soporten spacing
        if (!['core/paragraph', 'core/heading', 'core/group'].includes(name)) return <BlockEdit {...props} />;

        return (
            <>
                <BlockEdit {...props} />
                <InspectorControls>
                    <PanelBody title={__('Responsive Spacing')} initialOpen={false}>
                        <TabPanel
                            className="responsive-device-tabs"
                            activeClass="active-tab"
                            tabs={[
                                {
                                    name: 'desktop',
                                    title: devices.desktop,
                                    className: 'desktop-tab',
                                },
                                {
                                    name: 'tablet',
                                    title: devices.tablet,
                                    className: 'tablet-tab',
                                },
                                {
                                    name: 'mobile',
                                    title: devices.mobile,
                                    className: 'mobile-tab',
                                },
                            ]}
                            onSelect={(device) => setCurrentDevice(device)}
                        >
                            {(tab) => (
                                <div className={`responsive-controls-${tab.name}`}>
                                    {/* Margin */}
                                    <BoxControl
                                        label={__('Margin')}
                                        values={attributes[`${tab.name}Margin`]}
                                        onChange={(val) => setAttributes({ [`${tab.name}Margin`]: val })}
                                    />

                                    {/* Padding */}
                                    <BoxControl
                                        label={__('Padding')}
                                        values={attributes[`${tab.name}Padding`]}
                                        onChange={(val) => setAttributes({ [`${tab.name}Padding`]: val })}
                                    />
                                </div>
                            )}
                        </TabPanel>
                    </PanelBody>
                </InspectorControls>
            </>
        );
    };
}, 'withResponsiveControls');

// Registrar atributos
addFilter(
    'blocks.registerBlockType',
    'odiseiaframework/responsive-spacing-attributes',
    (settings, name) => {
        if (['core/paragraph', 'core/heading', 'core/group'].includes(name)) {
            settings.attributes = {
                ...settings.attributes,
                desktopMargin: { type: 'object' },
                tabletMargin: { type: 'object' },
                mobileMargin: { type: 'object' },
                desktopPadding: { type: 'object' },
                tabletPadding: { type: 'object' },
                mobilePadding: { type: 'object' },
            };
        }
        return settings;
    }
);

// Aplicar HOC
addFilter(
    'editor.BlockEdit',
    'mi-plugin/responsive-spacing',
    withResponsiveControls
);

// Generar estilos en el front
addFilter(
    'blocks.getSaveContent.extraProps',
    'mi-plugin/responsive-spacing-output',
    (props, block, attributes) => {
        const spacingStyles = {
            '--desktop-margin': attributes.desktopMargin?.top,
            '--tablet-margin': attributes.tabletMargin?.top,
            '--mobile-margin': attributes.mobileMargin?.top,
            '--desktop-padding': attributes.desktopPadding?.top,
            '--tablet-padding': attributes.tabletPadding?.top,
            '--mobile-padding': attributes.mobilePadding?.top,
        };

        return {
            ...props,
            style: { ...props.style, ...spacingStyles }
        };
    }
);
