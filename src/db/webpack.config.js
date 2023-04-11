const path = require('path');

module.exports = {
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify")
    }
  },
  mode: 'none',
  devtool: 'eval-source-map',
  entry: './main.js',
  output: {
    path: path.resolve(__dirname, '../bundle'),
    filename: 'bundle.js'
  }
};
