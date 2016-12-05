/**
 * Created by wuyuedong on 16/5/19.
 */

var path = require('path');
var webpack = require('webpack');
var packageConfig = require('./package.json');
var dir_src = path.resolve(__dirname, 'src');
var dir_build = path.resolve(__dirname, 'dist');


var env = process.env.NODE_ENV;
module.exports = {
    devtool: 'source-map',
    entry: {
        RequestCache: path.resolve(dir_src, 'index.js')
    },
    output: {
        //打包之后的模块化方式
        libraryTarget: "umd",
        library: "RequestCache",
        //打包文件存放路径
        path: path.resolve(dir_build),
        filename: '[name].min.js' //[name], [hash], [chunkhash]
    },
    module: {
        loaders: [
            {
                test: /\.(js|jsx)$/,
                loaders: ['babel?' + JSON.stringify({presets: ['es2015', 'stage-0']})],
                exclude: [/node_modules/, dir_build]
            }
        ]
    },
};