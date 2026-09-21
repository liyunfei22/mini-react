// 对应官方 packages/react/jsx-runtime.js。
// TS 的 "jsx": "react-jsx" + jsxImportSource 会把 <a/> 编译为
// `import { jsx } from '@mini-react/react/jsx-runtime'; jsx('a', {...})`。
import { Fragment } from './ReactElement';
import { jsx, jsxs } from './ReactJSXElement';

export { Fragment, jsx, jsxs };
export type { ReactElement } from './ReactElement';

/**
 * 供 TS 校验 JSX 的命名空间（automatic 运行时从 jsx-runtime 模块解析 JSX.*）。
 * 学习阶段不追求精确的属性类型：允许任意字符串标签，props 宽松接收。
 */
export namespace JSX {
  /** 一切 JSX 表达式最终产出一个 ReactElement */
  export type Element = import('./ReactElement').ReactElement;
  /** 允许任意字符串标签（div / span / ...）并宽松接收任意 props */
  export interface IntrinsicElements {
    [elemName: string]: unknown;
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface ElementChildrenAttribute {
    children: unknown;
  }
}