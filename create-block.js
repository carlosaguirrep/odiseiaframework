const fs = require('fs');
const path = require('path');

const blockName = process.argv[2];
if (!blockName) {
    console.error('Please, Insert the name of the Block');
    process.exit(1);
}

const blockDir = path.join(__dirname, 'src', blockName.replace(/ /g, '-'));
fs.mkdirSync(blockDir, { recursive: true });

const files = {
    'block.json': `{
"name": "odiseiaframework/${blockName.replace(/ /g, '-')}",
"title": "${blockName}",
"category": "text",
"icon": "format-paragraph",
"attributes": {
    "text": {
        "type": "string",
        "source": "html",
        "selector": "p",
        "default": "Default Text"
    }
}
}`,
    'edit.js': `import { RichText } from '@wordpress/block-editor';

const Edit = (props) => {
    const { attributes, setAttributes } = props;
    return (
        <RichText
            tagName="p"
            value={attributes.text}
            onChange={(value) => setAttributes({ text: value })}
        />
    );
};

export default Edit;`,
    'render.php': `<?php
function render_${blockName.replace(/ /g, '-')}_block($attributes) {
    return '<p>' . $attributes['text'] . '</p>';
}`,
    'save.js': `const Save = (props) => {
    const { attributes } = props;
    return <p dangerouslySetInnerHTML={{ __html: attributes.text }} />;
};

export default Save;`,
    'style.css': `$block-padding: 20px;

.wp-block-odiseiaframework-${blockName.replace(/ /g, '-')} {
    padding: $block-padding;
    background-color: #f3f3f3;
}`,
    'index.js': `import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import Save from './save';

registerBlockType('odiseiaframework/${blockName.replace(/ /g, '-')}', {
    edit: Edit,
    save: Save,
});`,
    'editor.css': `.wp-block-odiseiaframework-${blockName.replace(/ /g, '-')} {
    padding: 10px;
    border: 1px dashed #ccc;
}`,
    'view.js': `import { RichText } from '@wordpress/block-editor';

const View = (props) => {
    const { attributes } = props;
    return <p>{attributes.text}</p>;
};

export default View;`
};

Object.keys(files).forEach(file => {
    fs.writeFileSync(path.join(blockDir, file), files[file], 'utf8');
});

console.log(`The Block ${blockName} was created on ${blockDir}`);
