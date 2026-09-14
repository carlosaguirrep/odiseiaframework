import { useBlockProps } from '@wordpress/block-editor';

export default function save() {
  const blockProps = useBlockProps.save({ className: 'fondo-gradiente' });
  return <div {...blockProps}></div>;
}   