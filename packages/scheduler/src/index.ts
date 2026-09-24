// @mini-react/scheduler —— 对应官方 packages/scheduler。
// 第 14 章填充真身：MessageChannel 工作循环、任务/定时器最小堆、5ms 帧预算的 shouldYield。
// 命名对齐官方 unstable_*（第 16 章 reconciler 的并发路径会用到）。
export {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NoPriority,
  NormalPriority,
  UserBlockingPriority,
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_LowPriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
  unstable_cancelCallback,
  unstable_continueExecution,
  unstable_getCurrentPriorityLevel,
  unstable_getFirstCallbackNode,
  unstable_next,
  unstable_now,
  unstable_pauseExecution,
  unstable_runWithPriorityImpl as unstable_runWithPriority,
  unstable_scheduleCallback,
  unstable_shouldYield,
  unstable_wrapCallback,
} from './Scheduler';
export type { Task } from './Scheduler';
