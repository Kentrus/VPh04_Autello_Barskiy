// Webpack-конфиг для фронта.
//
// Две точки входа (multi-entry):
//   index  — публичный сайт (src/index.js + src/index.html)
//   admin  — админ-панель   (src/admin.js + src/admin.html)
// Каждая собирает свой bundle и подключает только свой CSS (через chunks в HtmlWebpackPlugin).
// Хэши в именах дают кэш-бустинг: обновили код → новый хэш → браузер скачивает заново.

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    index: './src/index.js',
    admin: './src/admin.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    // [name] = ключ из entry (index / admin). contenthash — под бустер кэша.
    filename: '[name].[contenthash].js',
    // publicPath '/' — браузер запрашивает /index.xxx.js и т.д. от корня сайта.
    publicPath: '/',
    // clean: true чистит dist/ перед сборкой — не копятся старые bundle-ы с разными хэшами.
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        // MiniCssExtractPlugin.loader вытаскивает CSS в отдельный файл (вместо инлайна в JS через style-loader).
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    // chunks: ['index'] — в index.html войдёт только JS/CSS точки index, не admin.
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      chunks: ['index'],
    }),
    new HtmlWebpackPlugin({
      template: './src/admin.html',
      filename: 'admin.html',
      chunks: ['admin'],
    }),
    new MiniCssExtractPlugin({
      // [name] = имя entry → index.[hash].css и admin.[hash].css отдельно.
      filename: '[name].[contenthash].css',
    }),
  ],
  // Dev-сервер для локальной разработки (npm run dev). В проде не используется.
  devServer: {
    static: path.resolve(__dirname, 'dist'),
    port: 8080,
    historyApiFallback: true,
  },
};
