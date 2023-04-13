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
  entry: {
    main: './main.js',
    account: './account.js'
  },
  output: {
    path: path.resolve(__dirname, '../js'),
    filename: '[name].js'
  }
};
