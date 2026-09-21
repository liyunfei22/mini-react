// ============================================================================
// names.js —— 产物命名与路径（对应官方 bundles.js 的 getFilename / packaging.js）
// ============================================================================
// 命名约定（镜像官方 node_modules 里的 react/react-dom 产物形状）：
//   react.development.js      （cjs 开发版）
//   react.production.min.js   （cjs 生产版，minified）
//   react.development.mjs     （esm 开发版）
//   react.production.min.mjs  （esm 生产版）
//   umd/react.development.js  （UMD 开发版）
//   umd/react.production.min.js
export function getOutputRelPath(bundle, format, env) {
  const qualifier = env.dev ? 'development' : 'production';
  const min = env.dev ? '' : '.min';
  return `dist/${format.dir}/${bundle.name}.${qualifier}${min}${format.ext}`;
}