import { RichText } from '@wordpress/block-editor';

const View = (props) => {
    const { attributes } = props;
    return <p>{attributes.text}</p>;
};

export default View;