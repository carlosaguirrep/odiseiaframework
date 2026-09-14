const path = require('path');
const glob = require('glob');

module.exports = {
    entry: glob.sync('./src/Plugins/**/*.js').reduce((entries, file) => {
        const name = path.relative('./src/Plugins', file).replace(/\.js$/, '');
        entries[`Plugins/${name}`] = file;
        return entries;
    }, {}),
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js',
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
        ],
    },
};
