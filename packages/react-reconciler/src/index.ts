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
  DefaultLane,
  InputContinuousLane,
  IdleLane,
  NonIdleLanes,
  NoLane,
  NoLanes,
  NoTimestamp,
  OffscreenLane,
  RetryLanes,
  SyncLane,
  TotalLanes,
  TransitionLanes,
  claimNextTransitionLane,
  createLaneMap,
  getHighestPriorityLane,
  getLanesToRetrySynchronouslyOnError,
  getNextLanes,
  hasAnyLanes,
  includesExpiredLane,
  includesNonIdleWork,
  includesSyncLane,
  intersectLanes,
  isSubsetOfLanes,
  isTransitionLane,
  laneToIndex,
  lanesToEventPriority,
  markRootEntangled,
  markRootExpired,
  markRootFinished,
  markRootMutableRead,
  markRootPinged,
  markRootSuspended,
  markRootUpdated,
  markStarvedLanesAsExpired,
  mergeLanes,
  pickArbitraryLane,
  pickArbitraryLaneIndex,
  removeLanes,
} from './ReactFiberLane';
export type { Lane, LaneMap, Lanes } from './ReactFiberLane';

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
import { flushSyncCallbacks, scheduleUpdateOnFiber, updateContainer } from './ReactFiberWorkLoop';

/** 创建 FiberRoot（官方 ReactFiberRoot.createFiberRoot 的公开入口）—— 第 3 章已可用 */
export function createContainer(containerInfo: unknown): FiberRootNode {
  return createFiberRoot(containerInfo, ConcurrentRoot);
}

// render/commit 调度的公开入口（第 4 章）
export { flushSyncCallbacks, scheduleUpdateOnFiber, updateContainer };
// passive effects 的异步 flush（第 9 章；测试里用于确定性 drain）
export { flushPassiveEffects } from './ReactFiberCommitWork';
