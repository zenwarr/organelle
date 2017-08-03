const webpack = require('webpack');
const fs = require('fs');
const path = require('path');

/* Compile all test modules */

var baseDir = 'src/test/';
var entries = {};

function processDir(dirName) {
  var fullDirPath = path.join(__dirname, '..', dirName);
  var files = fs.readdirSync(fullDirPath);

  for (var j = 0; j < files.length; ++j) {
    var filename = files[j];
    var filepath = path.join(__dirname, '..', dirName, filename);
    var relpath = path.join(dirName, filename);

    if (fs.statSync(filepath).isDirectory()) {
      processDir(relpath);
    } else {
      var extname = path.extname(relpath);
      if ((extname === '.ts' || extname === '.tsx') && path.basename(relpath).charAt(0) !== '_') {
        var entryName = relpath.slice(0, -extname.length);
        entries['test/' + entryName.slice(baseDir.length)] = './' + relpath;
      }
    }
  }
}

processDir(baseDir);

var webpackCommon = require('./common');

module.exports = {
  entry: entries,

  output: {
    filename: '[name].js',
    path: path.join(__dirname, '/../dist'),
    libraryTarget: 'commonjs'
  },

  target: 'node',

  externals: [webpackCommon.buildExternals()],

  node: {
    __dirname: false,
    __filename: false
  },

  resolve: {
    extensions: ['.webpack.js', '.ts', '.tsx', '.js']
  },

  module: {
    loaders: [
      {
        test: /\.ts[x]?$/,
        loader: 'ts-loader'
      }
    ]
  }
};
