import type { ReactElement } from '@mini-react/react';
import { Demo01 } from './demos/01-create-element/Demo01';
import { Demo02 } from './demos/02-mount/Demo02';
import { Demo03 } from './demos/03-commit/Demo03';

/**
 * 演示页总览。App 接收一个 tick 用于演示"二次渲染复用节点"（第 5 章）。
 */
export function App({ tick }: { tick: number }): ReactElement {
  return (
    <div className="app">
      <h1>mini-react —— 从零手写 React 18</h1>
      <p className="frame">第 {tick} 帧 · createRoot 二次 render（节点复用，不重建）</p>
      <Demo01 />
      <Demo02 />
      <Demo03 />
    </div>
  );
}
