const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: "./src/frontend/js/index.js", // keep ONLY if you need JS API calls

    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "app.js",
        publicPath: "/"
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            }
        ]
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: "./src/frontend/html/index.html",
            filename: "index.html",
            inject: "body"
        }),

        // new CopyWebpackPlugin([
        //     {
        //         from: "src/frontend/app-images",
        //         to: "images"
        //     }
        // ])
    ],

    devServer: {
        contentBase: path.join(__dirname, "dist"),
        compress: true,
        port: 3000,
        historyApiFallback: true,
        open: true
    }
};