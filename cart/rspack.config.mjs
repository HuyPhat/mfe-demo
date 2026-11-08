import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import pkg from './package.json' with { type: 'json' };

export default {
  entry: './src/index.js',
  output: {
    publicPath: 'auto', // chunk URLs resolve relative to wherever remoteEntry is hosted -> deploy to any CDN path
    uniqueName: 'cart',   // avoids global name collisions between apps on the same page
    clean: true,
  },
  resolve: { extensions: ['.js', '.jsx'] },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'ecmascript', jsx: true },
            transform: { react: { runtime: 'automatic' } },
          },
        },
      },
      // CSS Modules: class names get hashed -> no style collisions between micro-frontends
      { test: /\.module\.css$/, type: 'css/module' },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ title: 'cart', templateContent: '<div id="root"></div>' }),
    new rspack.DefinePlugin({ __APP_VERSION__: JSON.stringify(pkg.version) }),
    new ModuleFederationPlugin({
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: { './Cart': './src/Cart.jsx' },
      shared: {
        // singleton: only ONE React on the page (two Reacts = broken hooks)
        // requiredVersion: semver range this app accepts; mismatch -> warning in console
        react: { singleton: true, requiredVersion: pkg.dependencies.react },
        'react-dom': { singleton: true, requiredVersion: pkg.dependencies['react-dom'] },
      },
      dts: false, // plain JS demo; with TS, MF can generate & download remote types
    }),
  ],
  devServer: {
    port: 3002,
    headers: { 'Access-Control-Allow-Origin': '*' }, // host on :3000 fetches remotes cross-origin
  },
};
