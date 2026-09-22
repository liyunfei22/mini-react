// 对应官方 packages/react-reconciler/src/ReactFiberBeginWork.old.js。
// beginWork：给定一个 wip fiber，把它的 children 变成一支 fiber 子链表，返回第一个 child。
// workLoop 就靠"返回 child / 进 complete"来决定游标去向。
import { mountChildFibers, reconcileChildFibers } from './ReactChildFiber';
import type { FiberNode } from './ReactFiber';
import type { Lanes } from './ReactFiberLane';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
} from './ReactWorkTags';

/**
 * 消费"上一个 commit 的结果树"(current) 与"本轮新数据"(nextChildren)，
 * 产出 wip 的子 fiber 链。挂载（current 没孩子）走 mountChildFibers，否则 reconcileChildFibers。
 */
function reconcileChildren(
  current: FiberNode | null,
  workInProgress: FiberNode,
  nextChildren: unknown,
  renderLanes: Lanes,
): void {
  // 关键：只判 `current === null`（官方语义）。
  // 首屏时 HostRoot 的 current 已存在（一颗空 HostRoot），走 reconcileChildFibers →
  // 给顶层子节点打 Placement；再往下的新 fiber（current 为 null）才走 mountChildFibers。
  // 这样整棵树只有"根底下第一个组件"打了 Placement，commit 一次 appendAllChildren 挂全树。
  if (current === null) {
    // 这个 fiber 是全新的：其整棵子树都是新的，不需逐个打标记
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
  } else {
    // 已存在的 fiber：需要 diff（第 8 章）
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes,
    );
  }
}

/**
 * HostRoot：把传给 updateContainer 的 element 当作 children。
 * 取舍说明：官方此处的 updateHostRoot 走 UpdateQueue（processUpdateQueue → memoizedState.element）；
 * 第 4 章为避免引入 UpdateQueue/Update 模型，直读 pendingProps.children，第 6 章（hooks 更新）再替换。
 */
function updateHostRoot(
  current: FiberNode | null,
  workInProgress: FiberNode,
  renderLanes: Lanes,
): FiberNode | null {
  const nextProps = workInProgress.pendingProps as { children?: unknown } | null;
  const nextChildren = nextProps?.children ?? null;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

/**
 * 函数组件：直接调用组件函数拿到它返回的 element。
 * 注意：这是"无 hooks"的极简版——还没有 ReactCurrentDispatcher 那一套（第 6 章）。
 */
function updateFunctionComponent(
  current: FiberNode | null,
  workInProgress: FiberNode,
  renderLanes: Lanes,
): FiberNode | null {
  const Component = workInProgress.type as (props: unknown) => unknown;
  const props = workInProgress.pendingProps ?? {};
  const nextChildren = Component(props);
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

/** HostComponent（DOM 标签）：children 就是 props.children */
function updateHostComponent(
  current: FiberNode | null,
  workInProgress: FiberNode,
  renderLanes: Lanes,
): FiberNode | null {
  const nextProps = (workInProgress.pendingProps ?? {}) as { children?: unknown };
  reconcileChildren(current, workInProgress, nextProps.children ?? null, renderLanes);
  return workInProgress.child;
}

/**
 * beginWork —— 官方 beginWork 函数的 mini 版（去掉 bailout/context/offscreen 等分支）。
 * 返回 null 表示"这层结束了，向上 complete"；返回子 fiber 表示"继续往下"。
 */
export function beginWork(
  current: FiberNode | null,
  workInProgress: FiberNode,
  renderLanes: Lanes,
): FiberNode | null {
  switch (workInProgress.tag) {
    case IndeterminateComponent: {
      // 组件被真正调用的那一刻才知道它是函数还是类（mini 版一律按函数处理）
      return updateFunctionComponent(current, workInProgress, renderLanes);
    }
    case FunctionComponent:
      return updateFunctionComponent(current, workInProgress, renderLanes);
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case HostText:
      // 文本叶子：无子
      return null;
    default:
      throw new Error(
        `[react-reconciler] beginWork 尚未处理 tag ${workInProgress.tag}（第 4 章范围外）。`,
      );
  }
}
