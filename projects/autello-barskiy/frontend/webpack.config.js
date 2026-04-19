// Webpack-конфиг для фронта.
// Собирает src/* → dist/ (bundle.[hash].js, styles.[hash].css, index.html).
// Хэши в именах даёт кэш-бустинг: обновили код → новый хэш → браузер скачивает заново.

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    // publicPath '/' — браузер запрашивает /bundle.xxx.js, /styles.xxx.css.
    // Без этого возможны проблемы с относительными путями, когда ассеты
    // ищутся относительно текущего location (а не корня сайта).
    publicPath: '/',
    // clean: true чистит dist/ перед сборкой, чтоб не копились старые bundle-ы с разными хэшами.
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        // MiniCssExtractPlugin.loader вытаскивает CSS в отдельный файл (вместо инлайна в JS через style-loader).
        // Нужно для прод-раздачи: браузер грузит CSS параллельно с JS, стили применяются быстрее.
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    // Берёт наш src/index.html как шаблон и вставляет в него <script>/<link> с правильными хэш-именами.
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.[contenthash].css',
    }),
  ],
  // Dev-сервер для локальной разработки (npm run dev). В проде не используется.
  devServer: {
    static: path.resolve(__dirname, 'dist'),
    port: 8080,
    historyApiFallback: true,
  },
};
