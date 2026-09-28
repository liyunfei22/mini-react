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
import { ShouldCapture } from './ReactFiberFlags';
import { SuspenseComponent } from './ReactWorkTags';
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
  markRootPinged,
  markRootSuspended,
  markRootUpdated as markRootUpdatedLane,
  markStarvedLanesAsExpired,
  mergeLanes,
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

// 本轮渲染是否发生挂起（Suspense thenable throw）——驱动 renderRoot 收尾与 commit 记账分叉
let workInProgressRootDidSuspend = false;

const RootIncomplete = 0;
const RootCompleted = 2;

/** 是否为 thenable（有 .then 的可挂起对象）——官方 isThenable 的 mini 版 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * 处理一次 render 中的 thenable 抛掷（官方 handleError/throwException 的 mini 版，legacy 风格）：
 * 沿 return 链找最近的 Suspense 边界 → markRootSuspended → 注册 wake（resolve 后重燃 lane + ping）
 * → 给边界打 ShouldCapture → 回卷 workInProgress 到边界，让它这一轮渲染 fallback。
 * 返回 false 表示「不是 thenable / 无边界」——由调用方决定是否 rethrow（mini 无错误边界）。
 */
function handleThenableThrow(root: FiberRootNode, thrownValue: unknown, lanes: Lanes): boolean {
  if (!isThenable(thrownValue)) {
    return false;
  }
  let boundary: FiberNode | null = workInProgress;
  while (boundary !== null && boundary.tag !== SuspenseComponent) {
    boundary = boundary.return;
  }
  if (boundary === null) {
    return false; // 没有 Suspense 边界可承接：抛回给用户（对 true error 的模拟）
  }

  workInProgressRootDidSuspend = true;
  markRootSuspended(root, lanes);

  // mini 简化：挂起后丢弃 suspended 子树（无 Offscreen 保留），边界渲染 fallback，
  // promise resolve 后从头重渲染 primary（差异见文章）。
  boundary.flags |= ShouldCapture;

  let didWake = false;
  const wake = (): void => {
    if (didWake) return;
    didWake = true;
    // null 守卫（TS 收窄）：boundary 在此一定非 null
    markUpdateLaneFromFiberToRoot(boundary!, lanes); // 重燃 lane：让边界渲染 primary 而非继续 bailout
    markRootPinged(root, lanes); // 该 lane 现在可被 getNextLanes 捞回
    ensureRootIsScheduled(root);
  };
  thrownValue.then(wake, wake); // resolve 或 reject 都唤醒（挂起只关心"有结果了"）

  workInProgress = boundary; // 回卷到边界
  return true;
}

function prepareFreshStack(root: FiberRootNode): void {
  workInProgressRootRenderLanes = NoLanes;
  workInProgressRootDidSuspend = false;
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
  try {
    workLoopSync(lanes);
  } catch (thrownValue) {
    if (handleThenableThrow(root, thrownValue, lanes)) {
      workLoopSync(lanes); // 回卷到边界后，把边界这轮的 fallback 渲染完
    } else {
      throw thrownValue; // 无 Suspense 边界可承接：原样抛回（mini 无错误边界/类组件）
    }
  }
  finishRenderRoot(root, lanes);
}

/** 并发渲染（可中断）：时间片用尽返回 RootIncomplete，完成才产出 finishedWork（第 16 章） */
function renderRootConcurrent(root: FiberRootNode, lanes: Lane): number {
  prepareFreshStack(root);
  workInProgressRootRenderLanes = lanes;
  try {
    workLoopConcurrent();
  } catch (thrownValue) {
    if (handleThenableThrow(root, thrownValue, lanes)) {
      // 挂起：fallback 要立刻可见，回退同步渲染完（不再问 shouldYield）
      workLoopSync(lanes);
    } else {
      throw thrownValue;
    }
  }
  if (workInProgress !== null) {
    // 时间片用尽被打断——不产出 finishedWork（current 树原封不动，这就是双缓冲的意义）
    return RootIncomplete;
  }
  finishRenderRoot(root, lanes);
  return RootCompleted;
}

/** render 收尾：清挂起记账 + 产出成品树（renderRootSync/Concurrent 共用） */
function finishRenderRoot(root: FiberRootNode, lanes: Lane): void {
  // 本轮没挂起 = 成功渲染 → 清掉这些 lane 的挂起记录（可能是一次挂起后的成功 retry）
  if (!workInProgressRootDidSuspend) {
    root.suspendedLanes = removeLanes(root.suspendedLanes, lanes);
  }
  // 成品树 = root.current 的 alternate（prepareFreshStack 里 createWorkInProgress 已让两者互为 alternate）
  root.finishedWork = root.current.alternate;
  root.finishedLanes = lanes;
  workInProgress = null;
  workInProgressRootRenderLanes = NoLanes;
}

/** 同步渲染 + commit（官方 performSyncWorkOnRoot 的精简） */
function performSyncWorkOnRoot(root: FiberRootNode): void {
  const renderLanes = getNextLanes(root, NoLanes);
  let didCommit = false;
  try {
    renderRootSync(root, renderLanes);
    if (root.finishedWork !== null) {
      commitRoot(root); // commit 里 markRootFinished 已正确清账（含 Suspense 保留挂起 lane）
      didCommit = true;
    }
  } finally {
    // 失败/未 commit 才在这里补清账：抛错后 pendingLanes 残留会卡死后续调度（见
    // hooks.test 的"抛错后 root 复用"）。commit 成功路径绝不能在这里再 removeLanes——
    // 否则会把 commit 特意保留的 Suspense 挂起 lane 一并抹掉（第 19 章）。
    root.finishedWork = null;
    if (!didCommit) {
      root.pendingLanes = removeLanes(root.pendingLanes, renderLanes);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLanes;
    // 回收 Provider 栈：渲染中途抛错时 completeWork 的 popProvider 不会执行，
    // 不回收会导致 context._currentValue 残留、后续渲染值串味（第 11 章复核发现）。
    resetContextStack();
  }
  // 成功结束时：若还有残留 lane，续排下一批（第 15 章多 lane 的入口）。
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
 * 把一次更新的 lane「点燃」到 fiber 及其祖先链（官方 ReactFiberConcurrentUpdates.new.js
 * `markUpdateLaneFromFiberToRoot`）。第 18 章 bailout 的账本来源：
 *   - source fiber 的 `lanes |= lane`：beginWork 据此判断「我自己有没有待处理更新」；
 *   - 祖先链上每个 parent 的 `childLanes |= lane`：bailout 据此判断「我子树里有没有活」。
 * 只沿 return 链上冒（同步维护 alternate），兄弟子树不受影响——这是 bailout 能整段跳过的关键。
 */
export function markUpdateLaneFromFiberToRoot(sourceFiber: FiberNode, lane: Lane): FiberRootNode {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  let alternate = sourceFiber.alternate;
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }
  let parent = sourceFiber.return;
  let node = sourceFiber;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    alternate = parent.alternate;
    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane);
    }
    node = parent;
    parent = parent.return;
  }
  return node.stateNode as FiberRootNode;
}

/**
 * 调度一次更新（官方 scheduleUpdateOnFiber 的精简）。
 * 官方此处还有 render-phase 分支；mini 版由 dispatch 端抛错拦截渲染期更新。
 * 第 18 章起：先 markUpdateLaneFromFiberToRoot 记 fiber/childLanes 账，再 markRootUpdated。
 * 官方把 childLanes 上冒延后到 render 结束（finishQueueingConcurrentUpdates），mini 因为
 * 渲染期更新直接抛错，可安全即时上冒（差异见文章）。
 */
export function scheduleUpdateOnFiber(root: FiberRootNode, fiber: FiberNode, lane: Lane): void {
  markUpdateLaneFromFiberToRoot(fiber, lane);
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
