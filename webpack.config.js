const path = require('path');

module.exports = {
    entry: './lib/JsonLdParser.ts',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'out.js',
        path: path.resolve(__dirname, 'dist'),
    },
};
