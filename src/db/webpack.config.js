const path = require('path');

module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    entry: './main.js',
    output: {
        path: path.resolve(__dirname, '.././js'),
        filename: 'db.js'
    }
};
