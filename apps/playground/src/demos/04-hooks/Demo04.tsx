import { useState } from '@mini-react/react';

/**
 * 04 · useState：真实的交互更新。
 * 点击按钮 → dispatch → scheduleUpdateOnFiber → re-render → commitUpdate 只改文本节点。
 * 每次点 +1，App 反复 re-render，但此组件的 state 由 hook 链表保留（这正是 hooks 的意义）。
 */
export function Demo04() {
  const [count, setCount] = useState(0);
  return (
    <section className="demo-card">
      <h2>06 · useState：交互式计数器</h2>
      <p>
        当前值：<strong>{count}</strong>
      </p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>{' '}
      <button onClick={() => setCount((c) => c - 1)}>-1</button>
      <p>
        点击「+1」全程：dispatch（eager bailout 检查）→ 入队环形 pending → 调度 →
        re-render（updateReducer 处理队列）→ commit 只改文本。
      </p>
    </section>
  );
}
