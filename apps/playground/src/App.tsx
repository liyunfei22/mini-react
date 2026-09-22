import type { ReactElement } from '@mini-react/react';
import { Demo01 } from './demos/01-create-element/Demo01';
import { Demo02 } from './demos/02-mount/Demo02';

/**
 * 演示页总览。现在它真的是一棵被 Fiber 渲染的函数组件树：
 * App → Demo01 / Demo02 → host 元素，全部经 beginWork/completeWork 构建、commit 落 DOM。
 */
export function App(): ReactElement {
  return (
    <div className="app">
      <h1>mini-react —— 从零手写 React 18</h1>
      <p>本页由真正的 Fiber 渲染（createRoot，第 4 章），不再是第 1 章的递归 mini-render。</p>
      <Demo01 />
      <Demo02 />
    </div>
  );
}
