// Vue Single File Component (.vue) Shim
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Optional: SVG as modules (if used via imports)
declare module '*.svg' {
  const src: string;
  export default src;
}

// Optional: JSON as modules (Vite handles JSON, this keeps TS quiet for explicit imports)
declare module '*.json' {
  const value: any;
  export default value;
}
