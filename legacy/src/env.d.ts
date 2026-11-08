declare const __APP_VERSION__: string; // injected by DefinePlugin

declare module '*.module.css' {
  const classes: { readonly [className: string]: string };
  export = classes;
}
