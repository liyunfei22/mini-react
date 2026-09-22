import type { ReactElement } from '@mini-react/react';

const FIBER_TREE = [
  'HostRoot',
  'FunctionComponent(App)',
  'HostComponent(div)',
  'HostComponent(section)',
  'HostComponent(ul) → HostComponent(li) × N → HostText',
];

/**
 * 02 · Fiber 首屏挂载。
 * 下面这个列表本身，就是 beginWork/completeWork 建出 Fiber 树、commit 阶段落到 DOM 的产物。
 */
export function Demo02(): ReactElement {
  return (
    <section className="demo-card">
      <h2>04 · Fiber 首屏挂载</h2>
      <p>这段列表就是 Fiber 渲染出来的真实 DOM：</p>
      <ul>
        {FIBER_TREE.map((node) => (
          <li key={node}>{node}</li>
        ))}
      </ul>
      <p>
        打开控制台在 <code>#root</code> 上检查，你会看到浏览器原生节点 —— 全部由
        <code> hostConfig.createInstance / appendChildToContainer</code> 驱动。
      </p>
    </section>
  );
}
