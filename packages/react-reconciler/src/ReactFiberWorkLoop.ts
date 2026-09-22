// 对应官方 packages/react-reconciler/src/ReactFiberWorkLoop.old.js。
// 这是整台机器的"主循环"：scheduleUpdateOnFiber 被调用 → 同步入队 → workLoopSync 用
// beginWork/completeWork 把 element 变成一棵 Fiber 树 → commitRoot 落到 DOM。
// 第 14~16 章会在此基础上加并发（workLoopConcurrent 的 shouldYield 判断、Scheduler、Lane 优先级）。
import { completeWork } from './ReactFiberCompleteWork';
import { beginWork } from './ReactFiberBeginWork';
import { commitRoot } from './ReactFiberCommitWork';
import { createWorkInProgress } from './ReactFiber';
import type { FiberNode } from './ReactFiber';
import { SyncLane } from './ReactFiberLane';
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
function workLoopSync(): void {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: FiberNode): void {
  const current = unitOfWork.alternate;
  // 第 4 章固定走同步渲染：renderLanes 一律是 SyncLane（第 7/15 章才有多 lane 分派）
  const next = beginWork(current, unitOfWork, SyncLane);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // 这层没孩子了：向上"收口"
    completeUnitOfWork(unitOfWork);
  } else {
    // 有孩子：游标往下走
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork: FiberNode): void {
  let completedWork: FiberNode | null = unitOfWork;
  do {
    const current = completedWork.alternate;
    // 显式标注避免 TS 在 do...while 内对 completedWork/returnFiber 做循环引用推断
    const returnFiber: FiberNode | null = completedWork.return;

    const next = completeWork(current, completedWork, SyncLane);
    if (next !== null) {
      workInProgress = next;
      return;
    }

    // 上冒副作用（官方 bubbleProperties）：父亲要能知道"我子树里有没有要 commit 的改动"，
    // 否则 commit 阶段的 subtreeFlags 剪枝会漏掉整棵子树。
    if (returnFiber !== null) {
      returnFiber.subtreeFlags |= completedWork.flags;
      returnFiber.subtreeFlags |= completedWork.subtreeFlags;
    }

    // 有兄弟 → 去兄弟；否则一路回到 return
    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}

function renderRootSync(root: FiberRootNode): void {
  prepareFreshStack(root);
  workLoopSync();
  // 成品树 = root.current 的 alternate（prepareFreshStack 里 createWorkInProgress 已让两者互为 alternate）。
  // 不能读 workInProgress —— workLoop 结束后它已经是 null（游标走完了）。
  root.finishedWork = root.current.alternate;
  workInProgress = null;
}

/** 同步渲染 + commit（官方 performSyncWorkOnRoot 的精简） */
function performSyncWorkOnRoot(root: FiberRootNode): void {
  renderRootSync(root);
  if (root.finishedWork !== null) {
    commitRoot(root);
  }
}

/** 标记 root 有了新的待处理优先级（官方 markRootUpdated） */
function markRootUpdated(root: FiberRootNode, lane: Lane): void {
  root.pendingLanes |= lane;
}

/** 调度一次更新：官方 scheduleUpdateOnFiber 的精简（只走同步快捷路径） */
export function scheduleUpdateOnFiber(root: FiberRootNode, fiber: FiberNode, lane: Lane): void {
  if ((root.pendingLanes & lane) !== 0) {
    // 该泳道已有更新排队：合并，不重复入队（官方 ensureRootIsScheduled 复用 callbackNode 的同义守卫）
    return;
  }
  markRootUpdated(root, lane);
  scheduleSyncCallback(() => performSyncWorkOnRoot(root));
  // 把真正执行推迟到一个 microtask（批处理的基础，第 7 章会展开"为什么"）
  scheduleMicrotask(flushSyncCallbacks);
}

/**
 * 把一个 element 挂到 root 上并调度渲染 —— 官方 updateContainer 的 mini 版。
 * 第 4 章用 pendingProps 直传（第 6 章换成真正的 UpdateQueue.enqueueUpdate 路径）。
 */
export function updateContainer(element: unknown, container: FiberRootNode): void {
  const current = container.current;
  current.pendingProps = { children: element };
  // 第 4 章固定走同步 lane（第 7 章 requestUpdateLane 再谈优先级来源）
  scheduleUpdateOnFiber(container, current, SyncLane);
}

/** 测试/公开用：同步 drain 调度队列（ReactDOM.render 用它做同步渲染承诺） */
export { flushSyncCallbacks };
