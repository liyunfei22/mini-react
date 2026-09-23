import { useState } from '@mini-react/react';

/**
 * 05 · Diff：key 复用与移动。
 * 增/删/反转一个 keyed 列表——增删走复用+插入，反转走移动（insertBefore）。
 */
export function Demo05() {
  const [items, setItems] = useState([1, 2, 3]);

  return (
    <section className="demo-card">
      <h2>08 · Reconciliation / Diff</h2>
      <ul>
        {items.map((n) => (
          <li key={n}>item {n}</li>
        ))}
      </ul>
      <button onClick={() => setItems((p) => [...p, p.length + 1])}>+ 追加</button>{' '}
      <button onClick={() => setItems((p) => p.slice(0, -1))}>- 删除末位</button>{' '}
      <button onClick={() => setItems((p) => [...p].reverse())}>反转（移动）</button>
      <p>key 相同则复用节点（input 焦点、内部状态都保留）；位置落后才 Placement 移动。</p>
    </section>
  );
}
