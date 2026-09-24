// 对应官方 packages/react-reconciler/src/ReactFiberWorkLoop.old.js。
// 这是整台机器的"主循环"：requestUpdateLane 定优先级 → scheduleUpdateOnFiber → ensureRootIsScheduled
// （同步/并发两分支的调度中枢）→ workLoopSync 渲染 → commitRoot 落地。
// 第 14~16 章会在此加并发（workLoopConcurrent 的 shouldYield、Scheduler、Lane 优先级）。
import { completeWork } from './ReactFiberCompleteWork';
import { beginWork } from './ReactFiberBeginWork';
import {
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_LowPriority,
  unstable_NormalPriority,
  unstable_now,
  unstable_scheduleCallback,
  unstable_shouldYield,
  unstable_UserBlockingPriority,
} from '@mini-react/scheduler';
import { commitRoot } from './ReactFiberCommitWork';
import { createWorkInProgress } from './ReactFiber';
import { resetContextStack } from './ReactFiberNewContext';
import type { FiberNode } from './ReactFiber';
import {
  claimNextTransitionLane,
  DefaultHydrationLane,
  DefaultLane,
  getHighestPriorityLane,
  getNextLanes,
  hasAnyLanes,
  includesBlockingLane,
  includesExpiredLane,
  includesSyncLane,
  InputContinuousHydrationLane,
  InputContinuousLane,
  markRootUpdated as markRootUpdatedLane,
  markStarvedLanesAsExpired,
  NoLane,
  NoLanes,
  removeLanes,
  RetryLanes,
  SelectiveHydrationLane,
  SyncLane,
  TransitionLanes,
} from './ReactFiberLane';
import type { Lane, Lanes } from './ReactFiberLane';
import { ReactSharedInternals } from '@mini-react/shared';
import type { FiberRootNode } from './ReactFiberRoot';
import {
  flushSyncCallbacks,
  scheduleMicrotask,
  scheduleSyncCallback,
} from './ReactFiberSyncTaskQueue';

// ---- 模块级"渲染上下文" ----
let workInProgress: FiberNode | null = null;
let workInProgressRootRenderLanes: Lanes = NoLanes;

// 当前"显式优先级"（flushSync 设 SyncLane；第 16 章 requestUpdateLane 读它）
let currentUpdatePriority: Lane = NoLane;

const RootIncomplete = 0;
const RootCompleted = 2;

function prepareFreshStack(root: FiberRootNode): void {
  workInProgressRootRenderLanes = NoLanes;
  // 出现果树：从 current 造出 workInProgress。
  // 注意 pendingProps 要透传——updateContainer 把 element 写进了 root.current.pendingProps。
  workInProgress = createWorkInProgress(root.current, root.current.pendingProps);
}

/** 同步渲染主循环：没有 shouldYield —— 这就是"同步"与"并发"的唯一区别点 */
function workLoopSync(lanes: Lane): void {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress, lanes);
  }
}

/** 并发渲染主循环：每个工作单元前都问 shouldYield，时间片用尽即中断（第 16 章） */
function workLoopConcurrent(): void {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress, workInProgressRootRenderLanes);
  }
}

function lanesToSchedulerPriority(lanes: Lanes): number {
  const lane = getHighestPriorityLane(lanes);
  if (hasAnyLanes(lane, SyncLane)) return unstable_ImmediatePriority;
  if (hasAnyLanes(lane, InputContinuousHydrationLane | InputContinuousLane)) {
    return unstable_UserBlockingPriority;
  }
  if (hasAnyLanes(lane, DefaultHydrationLane | DefaultLane)) return unstable_NormalPriority;
  if (hasAnyLanes(lane, TransitionLanes | RetryLanes | SelectiveHydrationLane)) {
    return unstable_LowPriority;
  }
  return unstable_IdlePriority;
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
  workInProgressRootRenderLanes = lanes;
  workLoopSync(lanes);
  // 成品树 = root.current 的 alternate（prepareFreshStack 里 createWorkInProgress 已让两者互为 alternate）
  root.finishedWork = root.current.alternate;
  root.finishedLanes = lanes;
  workInProgress = null;
  workInProgressRootRenderLanes = NoLanes;
}

/** 并发渲染（可中断）：时间片用尽返回 RootIncomplete，完成才产出 finishedWork（第 16 章） */
function renderRootConcurrent(root: FiberRootNode, lanes: Lane): number {
  prepareFreshStack(root);
  workInProgressRootRenderLanes = lanes;
  workLoopConcurrent();
  if (workInProgress !== null) {
    // 时间片用尽被打断——不产出 finishedWork（current 树原封不动，这就是双缓冲的意义）
    return RootIncomplete;
  }
  root.finishedWork = root.current.alternate;
  root.finishedLanes = lanes;
  workInProgress = null;
  workInProgressRootRenderLanes = NoLanes;
  return RootCompleted;
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

/** 决定一次更新的优先级 lane（官方 requestUpdateLane） */
export function requestUpdateLane(_fiber: FiberNode): Lane {
  // ③ transition（useTransition/useDeferredValue 包裹）→ 动态申请 transition 泳道 → 走并发
  const transition = ReactSharedInternals.ReactCurrentBatchConfig.transition;
  if (transition !== null) {
    return claimNextTransitionLane();
  }
  // ④ 显式优先级（flushSync 设 SyncLane）→ 直接用
  if (currentUpdatePriority !== NoLane) {
    return currentUpdatePriority;
  }
  // ⑤ 默认：同步泳道（事件优先级 → lane 的桥接见 README 差异表；离散事件仍走同步）
  return SyncLane;
}

/** 显式优先级工厂（flushSync 用） */
export function getCurrentUpdatePriority(): Lane {
  return currentUpdatePriority;
}

/** 以最高优先级同步执行 fn 并立即 flush —— 对应官方 flushSync（从 react-dom 再导出） */
export function flushSync(fn: () => void): void {
  const previousPriority = currentUpdatePriority;
  currentUpdatePriority = SyncLane;
  try {
    fn();
  } finally {
    currentUpdatePriority = previousPriority;
  }
  flushSyncCallbacks();
}

/** 并发渲染 + commit（官方 performConcurrentWorkOnRoot；Scheduler 回调入口） */
function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean): void {
  const lanes = getNextLanes(root, workInProgressRootRenderLanes);
  // 只有在"非阻塞、未过期、未超时"的情况下才切时间片；否则退回同步把这条 lane 一次性跑完
  const shouldTimeSlice =
    !includesBlockingLane(lanes) && !includesExpiredLane(root, lanes) && !didTimeout;

  try {
    let finishedWork: FiberNode | null = null;
    if (shouldTimeSlice) {
      const exitStatus = renderRootConcurrent(root, lanes);
      finishedWork = exitStatus === RootCompleted ? root.finishedWork : null;
    } else {
      renderRootSync(root, lanes);
      finishedWork = root.finishedWork;
    }
    if (finishedWork !== null) {
      commitRoot(root);
    }
  } finally {
    root.callbackNode = null;
    root.callbackPriority = NoLanes;
    resetContextStack();
  }
  // 还有残留 lane → 续排
  if (root.pendingLanes !== NoLanes) {
    ensureRootIsScheduled(root);
  }
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
    // 并发路径：交给 Scheduler，按优先级排队做可中断渲染（第 16 章）
    if (root.callbackNode === null || root.callbackPriority !== newCallbackPriority) {
      const schedulerPriority = lanesToSchedulerPriority(nextLanes);
      const newCallbackNode = unstable_scheduleCallback(schedulerPriority, (didTimeout) =>
        performConcurrentWorkOnRoot(root, didTimeout),
      );
      root.callbackPriority = newCallbackPriority;
      root.callbackNode = newCallbackNode;
    }
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
