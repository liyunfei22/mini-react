import { createElement } from '@mini-react/react';
import type { ReactElement } from '@mini-react/react';
import { Demo01 } from './demos/01-create-element/Demo01';

/**
 * 第 1 章演示页：用"经典 createElement"（而非 JSX）拼装宿主元素树。
 * 配合 Demo01 的 JSX 路径，两条产 element 的路径在一页里对照展示。
 */
export function App(): ReactElement {
  return createElement(
    'div',
    { className: 'app' },
    createElement('h1', null, 'mini-react —— 从零手写 React 18'),
    createElement(
      'p',
      null,
      '本页由手写 mini-render 渲染，展示 createElement 与 JSX 自动运行时的产物（第 4 章起改用 Fiber）。',
    ),
    Demo01(),
  );
}