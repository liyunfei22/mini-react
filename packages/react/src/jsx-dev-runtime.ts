// 对应官方 packages/react/jsx-dev-runtime.js。
// dev 构建专用：playground 开发态（alias → src）会使用这里的 jsxDEV。
// 目前不产出独立 dist 产物（见 scripts/config.js 注释），类型声明已随 tsc -b 生成。
import { Fragment } from './ReactElement';
import { jsxDEV } from './ReactJSXElement';

export { Fragment, jsxDEV };
export type { ReactElement } from './ReactElement';