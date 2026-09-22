// 学习辅助：把 Fiber 树"打印成人能看懂的样子"。
// 官方没有这种东西——React 有 DevTools；我们手写阶段靠它看树结构，是最低成本的可视化。
// 后续章节（beginWork 生成树、commit 切换树）都会用它在测试里断言 + 在 playground 里展示。
import type { FiberNode } from './ReactFiber';
import {
  ClassComponent,
  Fragment,
  ForwardRef,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
} from './ReactWorkTags';

const TAG_NAMES: Record<number, string> = {
  [FunctionComponent]: 'FunctionComponent',
  [ClassComponent]: 'ClassComponent',
  [IndeterminateComponent]: 'IndeterminateComponent',
  [HostRoot]: 'HostRoot',
  [HostComponent]: 'HostComponent',
  [HostText]: 'HostText',
  [Fragment]: 'Fragment',
  [ForwardRef]: 'ForwardRef',
};

/** 把 fiber 子树格式化成缩进文本（每个节点一行：tag<type> + lanes） */
export function formatFiberTree(fiber: FiberNode | null): string {
  const lines: string[] = [];
  walk(fiber, 0, lines);
  return lines.join('\n');
}

function walk(fiber: FiberNode | null, depth: number, lines: string[]): void {
  if (fiber === null) {
    return;
  }
  const indent = '  '.repeat(depth);
  const tag = TAG_NAMES[fiber.tag] ?? `tag:${fiber.tag}`;
  const key = fiber.key != null ? ` key="${fiber.key}"` : '';
  const hostType =
    fiber.tag === HostComponent || fiber.tag === HostText ? ` \`${String(fiber.type)}\`` : '';
  lines.push(`${indent}${tag}${hostType}${key} (lanes:${fiber.lanes})`);

  let child = fiber.child;
  while (child !== null) {
    walk(child, depth + 1, lines);
    child = child.sibling;
  }
}
