const path = require('path');

module.exports = {
    mode: 'production',
    devtool: 'eval-source-map',
    entry: './main.js',
    output: {
        path: path.resolve(__dirname, '../'),
        filename: 'bundle.js'
    }
};
