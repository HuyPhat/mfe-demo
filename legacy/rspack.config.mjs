import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import pkg from './package.json' with { type: 'json' };

export default {
  entry: './src/index.ts',
  output: {
    publicPath: 'auto', // chunk URLs resolve relative to wherever remoteEntry is hosted -> deploy to any CDN path
    uniqueName: 'legacy',   // avoids global name collisions between apps on the same page
    clean: true,
  },
  resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic' } },
          },
        },
      },
      // CSS Modules: class names get hashed -> no style collisions between micro-frontends
      { test: /\.module\.css$/, type: 'css/module' },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ title: 'legacy', templateContent: '<div id="root"></div>' }),
    new rspack.DefinePlugin({ __APP_VERSION__: JSON.stringify(pkg.version) }),
    new ModuleFederationPlugin({
      name: 'legacy',
      filename: 'remoteEntry.js',
      exposes: { './mount': './src/mount.tsx' },
      shared: {
        // singleton: false -> this app keeps its OWN React 17. The host shares React 19, which does not
        // satisfy ^17, so the runtime falls back to the copy bundled here. It mounts its own root (see mount.tsx).
        react: { singleton: false, requiredVersion: pkg.dependencies.react },
        'react-dom': { singleton: false, requiredVersion: pkg.dependencies['react-dom'] },
      },
      dts: false, // plain JS demo; with TS, MF can generate & download remote types
    }),
  ],
  devServer: {
    port: 3003,
    hot: false, // remote runs inside host; its HMR runtime breaks with ChunkVersionError after rebuild
    headers: { 'Access-Control-Allow-Origin': '*' }, // host on :3000 fetches remotes cross-origin
  },
};
