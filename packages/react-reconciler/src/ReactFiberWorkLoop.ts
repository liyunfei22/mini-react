// 对应官方 packages/react-reconciler/src/ReactFiberWorkLoop.old.js。
// 这是整台机器的"主循环"：requestUpdateLane 定优先级 → scheduleUpdateOnFiber → ensureRootIsScheduled
// （同步/并发两分支的调度中枢）→ workLoopSync 渲染 → commitRoot 落地。
// 第 14~16 章会在此加并发（workLoopConcurrent 的 shouldYield、Scheduler、Lane 优先级）。
import { completeWork } from './ReactFiberCompleteWork';
import { beginWork } from './ReactFiberBeginWork';
import { commitRoot } from './ReactFiberCommitWork';
import { createWorkInProgress } from './ReactFiber';
import { resetContextStack } from './ReactFiberNewContext';
import type { FiberNode } from './ReactFiber';
import {
  getHighestPriorityLane,
  getNextLanes,
  includesSyncLane,
  NoLane,
  NoLanes,
  removeLanes,
  SyncLane,
} from './ReactFiberLane';
import type { Lane } from './ReactFiberLane';
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
  const renderLanes = getNextLanes(root);
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

/** 标记 root 有了新的待处理优先级（官方 markRootUpdated） */
function markRootUpdated(root: FiberRootNode, lane: Lane): void {
  root.pendingLanes |= lane;
}

/** 决定一次更新的优先级 lane（官方 requestUpdateLane 的骨架，四条路径留全占位） */
export function requestUpdateLane(_fiber: FiberNode): Lane {
  // 官方四条路径（按顺序）：
  // ① legacy mode（mode 不含 ConcurrentMode）→ SyncLane；本仓库只做并发模式，不需要。
  // ② 渲染期更新（executionContext & RenderContext）→ pickArbitraryLane(workInProgressRootRenderLanes)；第 16 章。
  // ③ transition → claimNextTransitionLane()；第 16 章。
  // ④ flushSync 等显式优先级（getCurrentUpdatePriority）→ 直接使用；第 15 章。
  // ⑤ 否则读当前事件优先级 → 映射到 lane；第 15 章事件系统接上后补。
  // 现阶段（无事件/无 transition）统一回落到同步泳道。
  return SyncLane;
}

/**
 * 调度中枢（官方 ensureRootIsScheduled）：按"最高优先级 lane 是否 sync"分派到
 * 同步快捷路径（scheduleSyncCallback）或并发路径（第 16 章 Scheduler）。
 * 复用判断用 callbackNode/callbackPriority（官方语义），不是"lane 位已在 pending 里"。
 */
function ensureRootIsScheduled(root: FiberRootNode): void {
  const nextLanes = getNextLanes(root);
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
    // 并发路径：第 14~16 章 scheduleCallback(Scheduler, performConcurrentWorkOnRoot)
    throw new Error('[react-reconciler] 并发调度尚未实现（第 14~16 章）。');
  }
}

/**
 * 调度一次更新（官方 scheduleUpdateOnFiber 的精简）。
 * 官方此处还有 render-phase 分支（渲染中触发 → mergeLanes 到 workInProgressRootRenderPhaseUpdatedLanes
 * 留待本轮结束重渲染）；mini 版第 6 章已由 dispatch 端抛错拦截渲染期更新，故 `fiber` 暂不使用。
 */
export function scheduleUpdateOnFiber(root: FiberRootNode, _fiber: FiberNode, lane: Lane): void {
  markRootUpdated(root, lane);
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
