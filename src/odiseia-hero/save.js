const { InnerBlocks } = wp.blockEditor;

const Save = (props) => {
    const { attributes } = props;
    return (
        <div>
            <InnerBlocks.Content />
        </div>
    );
};

export default Save;