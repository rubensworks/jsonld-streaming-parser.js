// eslint-disable-next-line import/no-nodejs-modules
const path = require('node:path');

module.exports = {
  entry: './lib/JsonLdParser.ts',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/u,
        use: 'ts-loader',
        exclude: /node_modules/u,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: 'out.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
