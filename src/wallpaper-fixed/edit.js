import { useEffect } from '@wordpress/element';
import { useBlockProps } from '@wordpress/block-editor';
import './editor.scss';

export default function Edit() {
  useEffect(() => {
    const isEditor = document.body.classList.contains('is-admin');
    const style = document.createElement('style');
    style.innerHTML = `
      .fondo-gradiente {
        position: ${isEditor ? 'absolute' : 'fixed'};
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const blockProps = useBlockProps({ className: 'fondo-gradiente' });

  return <div {...blockProps}></div>;
}