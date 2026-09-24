// 对应官方 packages/scheduler/src/forks/Scheduler.js（去掉 profiling / isInputPending）。
// 合作式调度器：把长任务切成 5ms 一片，每片之间用 MessageChannel（避开 setTimeout 4ms 钳制）
// 让出主线程，回到事件循环后继续下一片。
import { peek, pop, push } from './SchedulerMinHeap';
import type { Heap } from './SchedulerMinHeap';

// ---- 优先级与超时 ----
export const NoPriority = 0;
export const ImmediatePriority = 1;
export const UserBlockingPriority = 2;
export const NormalPriority = 3;
export const LowPriority = 4;
export const IdlePriority = 5;

const maxSigned31BitInt = 1073741823;
const IMMEDIATE_PRIORITY_TIMEOUT = -1;
const USER_BLOCKING_PRIORITY_TIMEOUT = 250;
const NORMAL_PRIORITY_TIMEOUT = 5000;
const LOW_PRIORITY_TIMEOUT = 10000;
const IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

// ---- 时间 ----
const hasPerformanceNow = typeof performance === 'object' && typeof performance.now === 'function';
const getCurrentTime: () => number = (() => {
  if (hasPerformanceNow) {
    const localPerformance = performance;
    return () => localPerformance.now();
  }
  const localDate = Date;
  const initialTime = localDate.now();
  return () => localDate.now() - initialTime; // 单调基准（官方回退写法）
})();

// ---- 帧预算：5ms（官方 frameYieldMs）----
const frameInterval = 5;

// ---- 任务队列（最小堆）----
export interface Task {
  id: number;
  callback: ((didTimeout: boolean) => unknown) | null;
  priorityLevel: number;
  startTime: number;
  expirationTime: number;
  sortIndex: number;
}

const taskQueue: Heap = [];
const timerQueue: Heap = [];
let taskIdCounter = 1;

let currentTask: Task | null = null;
let currentPriorityLevel = NormalPriority;
let isPerformingWork = false;

let isHostCallbackScheduled = false;
let isHostTimeoutScheduled = false;

const localSetTimeout: typeof setTimeout =
  typeof setTimeout === 'function' ? setTimeout : ((() => {}) as unknown as typeof setTimeout);
const localClearTimeout: typeof clearTimeout =
  typeof clearTimeout === 'function'
    ? clearTimeout
    : ((() => {}) as unknown as typeof clearTimeout);

// ---- MessageChannel 驱动的主循环 ----
let isMessageLoopRunning = false;
let scheduledHostCallback: ((hasTimeRemaining: boolean, initialTime: number) => boolean) | null =
  null;
let taskTimeoutID: ReturnType<typeof setTimeout> | number = -1;
let startTime = -1;

function advanceTimers(currentTime: number): void {
  let timer = peek(timerQueue);
  while (timer !== null) {
    const t = timer as Task;
    if (t.callback === null) {
      pop(timerQueue); // 已取消
    } else if (t.startTime <= currentTime) {
      // 延迟任务到期 → 转入 taskQueue，按过期时间排序
      pop(timerQueue);
      t.sortIndex = t.expirationTime;
      push(taskQueue, t);
    } else {
      return; // 其余都还没到点
    }
    timer = peek(timerQueue);
  }
}

function handleTimeout(currentTime: number): void {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);
  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    } else {
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, (firstTimer as Task).startTime - currentTime);
      }
    }
  }
}

function flushWork(hasTimeRemaining: boolean, initialTime: number): boolean {
  isHostCallbackScheduled = false;
  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;
  const previousPriorityLevel = currentPriorityLevel;
  try {
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
  }
}

function workLoop(hasTimeRemaining: boolean, initialTime: number): boolean {
  let currentTime = initialTime;
  advanceTimers(currentTime);
  currentTask = peek(taskQueue) as Task | null;
  while (currentTask !== null && !isSchedulerPaused) {
    if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
      // 未过期、且帧预算用尽 → 让出主线程，下一片继续
      break;
    }
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      currentPriorityLevel = currentTask.priorityLevel;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      const continuationCallback = callback(didUserCallbackTimeout);
      currentTime = getCurrentTime();
      if (typeof continuationCallback === 'function') {
        // 任务主动让出（返回继续执行的函数）
        currentTask.callback = continuationCallback as (didTimeout: boolean) => unknown;
      } else {
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
      advanceTimers(currentTime);
    } else {
      pop(taskQueue);
    }
    currentTask = peek(taskQueue) as Task | null;
  }
  if (currentTask !== null) {
    return true; // 还有活（时间片用尽）
  }
  const firstTimer = peek(timerQueue);
  if (firstTimer !== null) {
    requestHostTimeout(handleTimeout, (firstTimer as Task).startTime - currentTime);
  }
  return false;
}

function unstable_runWithPriority(priorityLevel: number, eventHandler: () => unknown): unknown {
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;
    default:
      priorityLevel = NormalPriority;
  }
  const previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;
  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

export function unstable_scheduleCallback(
  priorityLevel: number,
  callback: (didTimeout: boolean) => unknown,
  options?: { delay?: number },
): Task {
  const currentTime = getCurrentTime();

  let startTime: number;
  if (typeof options === 'object' && options !== null) {
    const delay = options.delay;
    startTime = typeof delay === 'number' && delay > 0 ? currentTime + delay : currentTime;
  } else {
    startTime = currentTime;
  }

  let timeout: number;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;
      break;
  }

  const expirationTime = startTime + timeout;
  const newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };

  if (startTime > currentTime) {
    // 延迟任务 → timerQueue
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      if (isHostTimeoutScheduled) {
        cancelHostTimeout();
      } else {
        isHostTimeoutScheduled = true;
      }
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
  }

  return newTask;
}

export function unstable_cancelCallback(task: Task): void {
  // 不从堆里物理删除（数堆只能删队头），只把 callback 置 null 标记取消
  task.callback = null;
}

export function unstable_getCurrentPriorityLevel(): number {
  return currentPriorityLevel;
}

function shouldYieldToHost(): boolean {
  return getCurrentTime() - startTime >= frameInterval;
}

// ---- 实现 host 能力的 MessageChannel 工作循环 ----
const performWorkUntilDeadline = (): void => {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();
    startTime = currentTime;
    const hasTimeRemaining = true;
    let hasMoreWork = true;
    try {
      hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      if (hasMoreWork) {
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    isMessageLoopRunning = false;
  }
};

const localSetImmediate: typeof setImmediate | null =
  typeof setImmediate !== 'undefined' ? setImmediate : null;

let schedulePerformWorkUntilDeadline: () => void;
if (localSetImmediate !== null) {
  // Node / IE / jsdom：优先 setImmediate（运行更早，也不像 MessageChannel 会阻止 Node 进程退出）
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== 'undefined') {
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => port.postMessage(null);
} else {
  schedulePerformWorkUntilDeadline = () => localSetTimeout(performWorkUntilDeadline, 0);
}

function requestHostCallback(
  callback: (hasTimeRemaining: boolean, initialTime: number) => boolean,
): void {
  scheduledHostCallback = callback;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

function requestHostTimeout(callback: (currentTime: number) => void, ms: number): void {
  taskTimeoutID = localSetTimeout(() => callback(getCurrentTime()), ms);
}

function cancelHostTimeout(): void {
  localClearTimeout(taskTimeoutID as ReturnType<typeof setTimeout>);
  taskTimeoutID = -1;
}

export const unstable_now = getCurrentTime;
export const unstable_shouldYield = shouldYieldToHost;
export const unstable_runWithPriorityImpl = unstable_runWithPriority;
export const unstable_getFirstCallbackNode = () => peek(taskQueue);

// ---- 官方的其余小事面（第 14 章按需补齐）----
export const unstable_ImmediatePriority = ImmediatePriority;
export const unstable_UserBlockingPriority = UserBlockingPriority;
export const unstable_NormalPriority = NormalPriority;
export const unstable_LowPriority = LowPriority;
export const unstable_IdlePriority = IdlePriority;

let isSchedulerPaused = false;

export function unstable_pauseExecution(): void {
  isSchedulerPaused = true;
}

export function unstable_continueExecution(): void {
  isSchedulerPaused = false;
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true;
    requestHostCallback(flushWork);
  }
}

/** 把"调用时的优先级"固化进返回的函数里（官方 unstable_wrapCallback） */
export function unstable_wrapCallback(callback: (...args: unknown[]) => unknown) {
  const parentPriorityLevel = currentPriorityLevel;
  return function (...args: unknown[]) {
    const previousPriorityLevel = currentPriorityLevel;
    currentPriorityLevel = parentPriorityLevel;
    try {
      return callback(...args);
    } finally {
      currentPriorityLevel = previousPriorityLevel;
    }
  };
}

export const unstable_next = unstable_wrapCallback;
