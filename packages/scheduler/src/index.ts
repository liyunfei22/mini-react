// @mini-react/scheduler —— 对应官方 packages/scheduler。
// 骨架阶段只提供：优先级枚举 + unstable_* 空桩（保证签名占位）。
// 第 14 章填充：MessageChannel 驱动的 requestHostCallback、任务/定时器最小堆、5ms 帧预算的 shouldYield。

export enum PriorityLevel {
  NoPriority = 0,
  ImmediatePriority = 1,
  UserBlockingPriority = 2,
  NormalPriority = 3,
  LowPriority = 4,
  IdlePriority = 5,
}

interface Callback {
  (didUserCallbackTimeout: boolean): unknown;
}

interface Task {
  id: number;
  callback: Callback | null;
  priorityLevel: PriorityLevel;
  startTime: number;
  expirationTime: number;
  sortIndex: number;
}

function notImplemented(name: string): never {
  throw new Error(
    `[@mini-react/scheduler] ${name} 尚未实现 —— 第 14 章填充（时间切片 / 任务队列）。`,
  );
}

/** 注册一个延迟/立即任务，返回 Task（后续可 cancelCallback） */
export function unstable_scheduleCallback(
  _priorityLevel: PriorityLevel,
  _callback: Callback,
  _options?: { delay?: number },
): Task {
  return notImplemented('unstable_scheduleCallback');
}

export function unstable_cancelCallback(_task: Task): void {
  notImplemented('unstable_cancelCallback');
}

/** 当前帧时间片是否用尽（第 14 章返回真实判断） */
export function unstable_shouldYield(): boolean {
  return false;
}

/** 当前时间戳（postMessage 循环的基准） */
export function unstable_now(): number {
  return Date.now();
}

export function unstable_runWithPriority(
  _priorityLevel: PriorityLevel,
  eventHandler: () => unknown,
): unknown {
  return eventHandler();
}
