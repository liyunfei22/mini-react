// 对应官方 packages/react-reconciler/src/ReactFiber.old.js。
// 本文件只负责"造 Fiber 节点"与"双缓冲"：一个 FiberNode + createFiber + createHostRootFiber + createWorkInProgress。
//
// Fiber 是什么？一个可遍历的、带调度信息的节点树：
// - 用 child / sibling / return 构成"链表树"，遍历不依赖递归（可随时中断）；
// - 用 alternate 与 current 树成对，构成"双缓冲"：一棵是屏幕上已提交的，一棵是正在改的。
import { NoFlags, StaticMask } from './ReactFiberFlags';
import type { Flags } from './ReactFiberFlags';
import { NoLanes } from './ReactFiberLane';
import type { Lanes } from './ReactFiberLane';
import type { WorkTag } from './ReactWorkTags';
import { HostRoot } from './ReactWorkTags';

export type FiberMode = number;

// 位值与官方 ReactTypeOfMode.js 一致（mode 是位掩码，可叠加）
export const NoMode: FiberMode = 0b000000;
export const StrictLegacyMode: FiberMode = 0b001000; // <StrictMode>（mini 版未实现）
export const ConcurrentMode: FiberMode = 0b000001; // "并发模式"开关位（React 18 createRoot 专用）

/** 依赖收集（第 11 章 Context 使用） */
export interface Dependencies {
  lanes: Lanes;
  firstContext: unknown | null;
}

/**
 * Fiber 节点 —— 官方 `function FiberNode(tag, pendingProps, key, mode)` 构造函数的 TS 版。
 * 字段分成五组，便于记忆（也对应官方注释的分组）：
 *   Identity：tag / key
 *   静态信息：elementType / type / stateNode
 *   树结构：return / child / sibling / index / ref
 *   渲染数据：pendingProps / memoizedProps / updateQueue / memoizedState / dependencies
 *   调度与副作用：mode / flags / subtreeFlags / deletions / lanes / childLanes / alternate
 */
export class FiberNode {
  // Instance
  tag: WorkTag;
  key: null | string;
  elementType: unknown = null;
  type: unknown = null;
  stateNode: unknown = null;

  // Fiber tree
  return: FiberNode | null = null;
  child: FiberNode | null = null;
  sibling: FiberNode | null = null;
  index: number = 0;
  ref: unknown = null;

  // Render data
  pendingProps: unknown;
  memoizedProps: unknown = null;
  updateQueue: unknown = null;
  memoizedState: unknown = null;
  dependencies: Dependencies | null = null;

  // Scheduling & effects
  mode: FiberMode;
  flags: Flags = NoFlags;
  subtreeFlags: Flags = NoFlags;
  deletions: FiberNode[] | null = null;
  lanes: Lanes = NoLanes;
  childLanes: Lanes = NoLanes;

  // Double buffering
  alternate: FiberNode | null = null;

  constructor(tag: WorkTag, pendingProps: unknown, key: null | string, mode: FiberMode) {
    this.tag = tag;
    this.key = key;
    this.pendingProps = pendingProps;
    this.mode = mode;
  }
}

export function createFiber(
  tag: WorkTag,
  pendingProps: unknown,
  key: null | string,
  mode: FiberMode,
): FiberNode {
  return new FiberNode(tag, pendingProps, key, mode);
}

/** 创建 root fiber（HostRoot tag）。React 18 统一走并发模式。 */
export function createHostRootFiber(): FiberNode {
  return createFiber(HostRoot, null, null, ConcurrentMode);
}

/**
 * 创建 workInProgress —— 双缓冲的灵魂。
 * 官方同名函数。约定：current 是"已提交、正显示"的树；wip 是"正在渲染"的树。
 *
 *   - 首次：current.alternate 为空 → 全新分配一个 fiber，并把两者互为 alternate；
 *   - 复用：current.alternate 已存在 → 直接捡回来，只重置"渲染期临时状态"（flags/subtreeFlags/deletions），
 *     静态信息（type/stateNode）保留 —— 因此反复更新不会反复 new 节点，也就没有 GC 压力。
 *   - 末尾统一做一次"快照拷贝"：child / memoizedProps / memoizedState / updateQueue 等从 current 带过来，
 *     作为本轮渲染的起点；静态 flag（StaticMask）也保留下来。
 *
 * 因为"复用"发生在每一次渲染，alternate 关系让一棵节点在 current 与 wip 之间来回切换，
 * 最终 commit 时只需把 fiberRoot.current 指过去（第 5 章）。
 */
export function createWorkInProgress(current: FiberNode, pendingProps: unknown): FiberNode {
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    // 首次：不存在备用节点，全新分配并成对
    workInProgress = createFiber(current.tag, pendingProps, current.key, current.mode);
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // 复用：重置渲染期临时状态，静态信息保留
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;

    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  // ---- 快照拷贝：以 current 的提交结果作为本轮起点 ----
  workInProgress.flags = current.flags & StaticMask;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  // dependencies 是对象，避免与 current 共享引用（否则半个 wip 会污染 current）
  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          lanes: currentDependencies.lanes,
          firstContext: currentDependencies.firstContext,
        };

  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;

  return workInProgress;
}
