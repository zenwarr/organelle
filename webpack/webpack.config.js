const webpack = require('webpack');
const webpackCommon = require('./common');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
  {
    /**
     * Server
     */
    entry: './src/server/index.ts',

    output: {
      filename: "bundle.js",
      path: path.join(__dirname, '/../dist/server'),
      libraryTarget: 'commonjs'
    },

    devtool: 'source-map',

    externals: [webpackCommon.buildExternals()],

    target: 'node',

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json', '.webpack.js']
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader'
        },
        {
          enforce: 'pre',
          test: /\.js$/,
          loader: 'source-map-loader'
        }
      ]
    }
  },

  {
    /**
     * Client
     */

    entry: './src/client/index.tsx',

    output: {
      filename: "bundle.js",
      path: path.join(__dirname, '/../dist/client')
    },

    devtool: 'source-map',

    target: 'web',

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json', '.webpack.js']
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader'
        },
        {
          enforce: 'pre',
          test: /\.js$/,
          loader: 'source-map-loader'
        }
      ]
    },

    plugins: [new HtmlWebpackPlugin({
      title: 'Organelle'
    })]
  }
];
