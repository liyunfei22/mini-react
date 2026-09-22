import type { ReactElement } from '@mini-react/react';

/**
 * 03 · commit 三阶段（更新/删除）。
 * 内容本身静态；右上角那一行"第 N 帧"由 main.tsx 每秒 re-render 一次驱动——
 * 第二次 render 命中"同 type/key 复用"，走 commitUpdate 只改文本，不重建 DOM。
 */
export function Demo03(): ReactElement {
  return (
    <section className="demo-card">
      <h2>05 · commit 三阶段：更新与删除</h2>
      <ul>
        <li>BeforeMutation → Mutation → 交换 root.current → Layout</li>
        <li>同 type/key 复用 fiber，props 差分只改 diff（commitUpdate）</li>
        <li>render(null) 走 Deletion，把旧 DOM 整棵移除</li>
      </ul>
      <p>看右上角计数器：每帧都是一次真实的「复用 + 更新」提交。</p>
    </section>
  );
}
