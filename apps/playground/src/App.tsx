import { Demo01 } from './demos/01-create-element/Demo01';
import { Demo02 } from './demos/02-mount/Demo02';
import { Demo03 } from './demos/03-commit/Demo03';
import { Demo04 } from './demos/04-hooks/Demo04';
import { Demo05 } from './demos/05-diff/Demo05';

/**
 * 演示页总览：所有 demo 都是函数组件，经 Fiber 渲染。
 */
export function App() {
  return (
    <div className="app">
      <h1>mini-react —— 从零手写 React 18</h1>
      <Demo01 />
      <Demo02 />
      <Demo03 />
      <Demo04 />
      <Demo05 />
    </div>
  );
}
