// @mini-react/react-reconciler —— 与 host 无关的 reconciler。
// 第 1 章：HostConfig 注入点；第 3 章：Fiber 数据结构与双缓冲；第 4 章起：render/commit 流程逐步接上。

export { initializeHostConfig, hostConfig } from './HostConfig';
export type { HostConfig, Props } from './HostConfig';

// ---- Fiber 数据结构（第 3 章）----
export {
  ConcurrentMode,
  NoMode,
  StrictLegacyMode,
  createFiber,
  createHostRootFiber,
  createWorkInProgress,
} from './ReactFiber';
export type { Dependencies, FiberMode, FiberNode } from './ReactFiber';

export { ConcurrentRoot, FiberRootNode, LegacyRoot, createFiberRoot } from './ReactFiberRoot';
export type { RootTag } from './ReactFiberRoot';

export * from './ReactFiberFlags';

export {
  NoLane,
  NoLanes,
  SyncLane,
  TotalLanes,
  getHighestPriorityLane,
  isSubsetOfLanes,
} from './ReactFiberLane';
export type { Lane, Lanes } from './ReactFiberLane';

export {
  ClassComponent,
  ContextConsumer,
  ContextProvider,
  ForwardRef,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  IndeterminateComponent,
  LazyComponent,
  MemoComponent,
  Mode,
  Profiler,
  SimpleMemoComponent,
  SuspenseComponent,
} from './ReactWorkTags';
export type { WorkTag } from './ReactWorkTags';

export { formatFiberTree } from './DebugFiber';

// ---- 公共 API（第 4 章起逐章补全）----
import { ConcurrentRoot, createFiberRoot } from './ReactFiberRoot';
import type { FiberRootNode } from './ReactFiberRoot';

/** 创建 FiberRoot（官方 ReactFiberRoot.createFiberRoot 的公开入口）—— 第 3 章已可用 */
export function createContainer(containerInfo: unknown): FiberRootNode {
  return createFiberRoot(containerInfo, ConcurrentRoot);
}

/**
 * 把 element 放进 root 并调度一次渲染 —— 第 4 章实现。
 * 届时需确定入队策略（官方走 UpdateQueue.enqueueUpdate）：mini 版第 4 章暂用
 * root.pendingChildren 直接挂载路径，UpdateQueue 模型留到第 6 章（hooks 更新）再补齐。
 */
export function updateContainer(_element: unknown, _container: unknown): never {
  throw new Error('[react-reconciler] updateContainer 尚未实现 —— 第 4 章开始填充。');
}
