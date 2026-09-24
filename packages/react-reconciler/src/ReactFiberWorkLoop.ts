// 对应官方 packages/react-reconciler/src/ReactFiberWorkLoop.old.js。
// 这是整台机器的"主循环"：requestUpdateLane 定优先级 → scheduleUpdateOnFiber → ensureRootIsScheduled
// （同步/并发两分支的调度中枢）→ workLoopSync 渲染 → commitRoot 落地。
// 第 14~16 章会在此加并发（workLoopConcurrent 的 shouldYield、Scheduler、Lane 优先级）。
import { completeWork } from './ReactFiberCompleteWork';
import { beginWork } from './ReactFiberBeginWork';
import { unstable_now } from '@mini-react/scheduler';
import { commitRoot } from './ReactFiberCommitWork';
import { createWorkInProgress } from './ReactFiber';
import { resetContextStack } from './ReactFiberNewContext';
import type { FiberNode } from './ReactFiber';
import {
  claimNextTransitionLane,
  getHighestPriorityLane,
  getNextLanes,
  includesSyncLane,
  markRootUpdated as markRootUpdatedLane,
  markStarvedLanesAsExpired,
  NoLane,
  NoLanes,
  removeLanes,
  SyncLane,
} from './ReactFiberLane';
import type { Lane } from './ReactFiberLane';
import { ReactSharedInternals } from '@mini-react/shared';
import type { FiberRootNode } from './ReactFiberRoot';
import {
  flushSyncCallbacks,
  scheduleMicrotask,
  scheduleSyncCallback,
} from './ReactFiberSyncTaskQueue';

// ---- 模块级"渲染上下文"（官方用全局 workInProgress / workInProgressRoot 持有；后者在并发章节引入）----
let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode): void {
  // 出现果树：从 current 造出 workInProgress。
  // 注意 pendingProps 要透传——updateContainer 把 element 写进了 root.current.pendingProps，
  // 这里传 null 会把待渲染内容抹掉（官方走 UpdateQueue 而非 pendingProps，第 6 章对齐）。
  workInProgress = createWorkInProgress(root.current, root.current.pendingProps);
}

/** 同步渲染主循环：没有 shouldYield —— 这就是"同步"与"并发"的唯一区别点 */
function workLoopSync(lanes: Lane): void {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress, lanes);
  }
}

function performUnitOfWork(unitOfWork: FiberNode, lanes: Lane): void {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork, lanes);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    completeUnitOfWork(unitOfWork, lanes);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork: FiberNode, lanes: Lane): void {
  let completedWork: FiberNode | null = unitOfWork;
  do {
    const current = completedWork.alternate;
    // 显式标注避免 TS 在 do...while 内对 completedWork/returnFiber 做循环引用推断
    const returnFiber: FiberNode | null = completedWork.return;

    const next = completeWork(current, completedWork, lanes);
    if (next !== null) {
      workInProgress = next;
      return;
    }

    // 上冒副作用（官方 bubbleProperties）
    if (returnFiber !== null) {
      returnFiber.subtreeFlags |= completedWork.flags;
      returnFiber.subtreeFlags |= completedWork.subtreeFlags;
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}

function renderRootSync(root: FiberRootNode, lanes: Lane): void {
  prepareFreshStack(root);
  workLoopSync(lanes);
  // 成品树 = root.current 的 alternate（prepareFreshStack 里 createWorkInProgress 已让两者互为 alternate）
  root.finishedWork = root.current.alternate;
  root.finishedLanes = lanes;
  workInProgress = null;
}

/** 同步渲染 + commit（官方 performSyncWorkOnRoot 的精简） */
function performSyncWorkOnRoot(root: FiberRootNode): void {
  const renderLanes = getNextLanes(root, NoLanes);
  try {
    renderRootSync(root, renderLanes);
    if (root.finishedWork !== null) {
      commitRoot(root);
    }
  } finally {
    // 无论成败都复位：抛错后 pendingLanes 残留会卡死后续调度、callbackNode 残留会让
    // 下次 ensureRootIsScheduled 误判"已调度"而吞更新，故两者都必须在 finally 里清。
    root.finishedWork = null;
    root.pendingLanes = removeLanes(root.pendingLanes, renderLanes);
    root.callbackNode = null;
    root.callbackPriority = NoLanes;
    // 回收 Provider 栈：渲染中途抛错时 completeWork 的 popProvider 不会执行，
    // 不回收会导致 context._currentValue 残留、后续渲染值串味（第 11 章复核发现）。
    resetContextStack();
  }
  // 成功结束时：若还有残留 lane，续排下一批（第 15 章多 lane 的入口）。
  // 抛错时本行不执行，但 finally 已清干净，下次调度可恢复（见 hooks.test 的"抛错后 root 复用"）。
  if (root.pendingLanes !== NoLanes) {
    ensureRootIsScheduled(root);
  }
}

/** 决定一次更新的优先级 lane（官方 requestUpdateLane，四条路径） */
export function requestUpdateLane(_fiber: FiberNode): Lane {
  // ① legacy mode（不含 ConcurrentMode）→ SyncLane；本仓库只做并发模式，跳过。
  // ② 渲染期更新 → 复用当前渲染 lane；本仓库由 dispatch 端抛错拦截，跳过。
  // ③ transition（useTransition 包裹）→ 动态申请一条 transition 泳道（第 16 章正式启用）。
  const transition = ReactSharedInternals.ReactCurrentBatchConfig.transition;
  if (transition !== null) {
    return claimNextTransitionLane();
  }
  // ④/⑤ 事件优先级 → lane：第 16 章接 getCurrentEventPriority 后按优先级选泳道；
  // 现阶段统一回落 SyncLane（事件触发后的 setState 仍同步渲染）。
  return SyncLane;
}

/**
 * 调度中枢（官方 ensureRootIsScheduled）：按"最高优先级 lane 是否 sync"分派到
 * 同步快捷路径（scheduleSyncCallback）或并发路径（第 16 章 Scheduler）。
 * 复用判断用 callbackNode/callbackPriority（官方语义），不是"lane 位已在 pending 里"。
 */
function ensureRootIsScheduled(root: FiberRootNode): void {
  const currentTime = unstable_now();
  // 饥饿保护：把"过期"的 lane 标记出来（低优先级最终也要跑）
  markStarvedLanesAsExpired(root, currentTime);
  const nextLanes = getNextLanes(root, NoLanes);
  if (nextLanes === NoLanes) {
    // 无事可做：没有待调度 lane（官方还会 cancel 掉现有 callback）
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  if (includesSyncLane(newCallbackPriority)) {
    // 同步路径：只有"优先级变了 / 还没调度"才重新入队
    if (root.callbackNode === null || root.callbackPriority !== newCallbackPriority) {
      scheduleSyncCallback(() => performSyncWorkOnRoot(root));
      scheduleMicrotask(flushSyncCallbacks);
      root.callbackPriority = newCallbackPriority;
      root.callbackNode = {}; // 占位（第 16 章换成真正 scheduler task）
    }
  } else {
    // 并发路径：第 16 章 scheduleCallback(Scheduler, performConcurrentWorkOnRoot)
    throw new Error('[react-reconciler] 并发调度尚未实现（第 16 章）。');
  }
}

/**
 * 调度一次更新（官方 scheduleUpdateOnFiber 的精简）。
 * 官方此处还有 render-phase 分支；mini 版由 dispatch 端抛错拦截渲染期更新。
 */
export function scheduleUpdateOnFiber(root: FiberRootNode, _fiber: FiberNode, lane: Lane): void {
  markRootUpdatedLane(root, lane, unstable_now());
  ensureRootIsScheduled(root);
}

/**
 * 把一个 element 挂到 root 上并调度渲染 —— 官方 updateContainer 的精简。
 * 第 4 章用 pendingProps 直传（第 6 章换成真正的 UpdateQueue.enqueueUpdate 路径）。
 */
export function updateContainer(element: unknown, container: FiberRootNode): void {
  const current = container.current;
  current.pendingProps = { children: element };
  const lane = requestUpdateLane(current);
  scheduleUpdateOnFiber(container, current, lane);
}

/** 测试/公开用：同步 drain 调度队列（ReactDOM.render 用它做同步渲染承诺） */
export { flushSyncCallbacks };
export type { Lane };
