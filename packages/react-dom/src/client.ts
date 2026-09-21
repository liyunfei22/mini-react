// react-dom/client 入口（对应官方 packages/react-dom/client.js）。
// 官方这里是个 NODE_ENV chooser 薄 shim，最终重导出 react-dom 主包；
// mini-repo 更省一层：package.json 的 "./client" exports 直接指向主包同一份产物
//（见 scripts/config.js 与 react-dom/package.json 的注释），本文件只为 dev 态（alias）与类型提供真实入口。
export { createRoot, hydrateRoot } from './index';
