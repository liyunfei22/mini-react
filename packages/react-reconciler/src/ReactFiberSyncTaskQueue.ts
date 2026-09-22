// 对应官方 packages/react-reconciler/src/ReactFiberSyncTaskQueue.old.js。
// 第 4~7 章的"同步调度"形态：ScheduleUpdateOnFiber 把一次同步渲染入队，用 microtask 统一 flush。
// 到第 14/16 章接入 Scheduler 后，这条"同步快捷路径"仍保留（React 里 SyncLane 走的就是它）。

let syncQueue: Array<() => void> | null = null;
let isFlushingSyncQueue = false;

export function scheduleSyncCallback(callback: () => void): void {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

/** 把"真正执行回调"推迟到一个 microtask（不止 React，很多框架用 queueMicrotask 做批处理） */
export function scheduleMicrotask(callback: () => void): void {
  queueMicrotask(callback);
}

/** 同步 drain 队列（幂等：重复调用 / microtask 再触发都安全） */
export function flushSyncCallbacks(): void {
  if (isFlushingSyncQueue || syncQueue === null) {
    return;
  }
  isFlushingSyncQueue = true;
  const queue = syncQueue;
  syncQueue = null;
  try {
    for (const callback of queue) {
      callback();
    }
  } finally {
    isFlushingSyncQueue = false;
  }
}
