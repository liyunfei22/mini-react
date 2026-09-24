---
title: React 源码解析 14：Scheduler——5ms 一片的时间切片是怎么切出来的
summary: React 怎么能一边渲染一边不卡住浏览器？拆开 scheduler 包：MessageChannel 驱动的任务循环、sortIndex 最小堆、delay 定时堆、以及每片 5ms 帧预算的 shouldYield——理解了它，就理解了"可中断渲染"的地基。
tags: [前端, React, 源码分析, 调度, 并发]
cover: https://cdn.jsdelivr.net/gh/<你的GitHub用户名>/mini-react@main/articles/14-scheduler/assets/cover.png
date: 2026-09-24
series: mini-react 源码解析
seriesIndex: 14
originalSource: https://github.com/<你的GitHub用户名>/mini-react
draft: true
---

# 问题：一段要跑 100ms 的渲染，怎么不卡死浏览器

浏览器一帧 16ms，如果一段 JS 同步跑 100ms，期间无法响应点击、无法绘制——界面就"卡"了。React 18 的答案是把长任务**切成 5ms 一片**，每片跑完主动让出主线程，下一片在下一个消息循环继续。

这套"切片的机制"不在 reconciler 里，而在一个独立的包：**scheduler**。

## 官方实现里发生了什么

调度器有三个核心零件：

**1. 最小堆队列**

任务按 `sortIndex` 存进二叉最小堆（`SchedulerMinHeap.js`），`peek` 永远拿到最该执行的那个；`delay` 任务先放进 `timerQueue`（按 `startTime` 排），到点后 `advanceTimers` 把它转入 `taskQueue`。

**2. MessageChannel 主循环**

```js
const channel = new MessageChannel();
channel.port1.onmessage = performWorkUntilDeadline;
schedulePerformWorkUntilDeadline = () => port.postMessage(null);
```

为什么不用 `setTimeout(0)`？因为浏览器对 `setTimeout` 有 **4ms 的下限钳制**；MessageChannel 没有这个钳制，能更快地切回主线程。

**3. 5ms 帧预算**

```js
function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  return timeElapsed >= frameInterval; // frameInterval = 5ms
}
function workLoop(hasTimeRemaining, initialTime) {
  let currentTask = peek(taskQueue);
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break; // 预算用尽，让出主线程，下一片继续
    }
    const continuation = currentTask.callback(currentTask.expirationTime <= currentTime);
    if (typeof continuation === 'function') {
      currentTask.callback = continuation; // 任务"主动让出"，接着跑
    } else {
      pop(taskQueue);
    }
    currentTask = peek(taskQueue);
  }
}
```

优先级 → 超时时间：`Immediate=-1`（立即）、`UserBlocking=250ms`、`Normal=5000ms`、`Low=10000ms`、`Idle=2^30-1`（永不过期）。过期任务不再让出（`expirationTime <= currentTime` 时强制跑），这就是"饥饿保护"：低优先级任务最晚在其超时后也会执行。

## 我们动手：mini-实现

`packages/scheduler/src/`：

| 文件 | 内容 |
| --- | --- |
| `SchedulerMinHeap.ts` | 最小堆 push/peek/pop（siftUp/siftDown） |
| `Scheduler.ts` | 优先级+超时、MessageChannel 主循环、workLoop/shouldYieldToHost、delay/cancel/continuation |
| `index.ts` | 导出 `unstable_*`（对齐官方命名） |

第 16 章 reconciler 的并发路径（`ensureRootIsScheduled` 的并发分支）会调用这里的 `unstable_scheduleCallback`。

## 一个值得记下的实现细节：cancel 靠"置 null"而非删除

`unstable_cancelCallback(task)` 只是 `task.callback = null`，并没有从堆里物理删掉它。因为**数组实现的堆只能高效移除队头**，任意节点删除要 O(n)。所以取消的任务在 `workLoop` 里被 `typeof callback !== 'function'` 分支直接 `pop` 掉——一个用"惰性清理"换 O(1) 取消的取舍。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| isInputPending（连续输入检测） | 有 | 无（简化 shouldYield） |
| profiling / forceFrameRate | 有 | 无 |
| 核心：最小堆 / MessageChannel / 5ms 预算 | 有 | 有（逐字对齐） |
| unstable_wrapCallback / pause / requestPaint | 有 | 部分（保留核心） |

## 验证

```bash
pnpm test    # scheduler.test.ts：优先级顺序 / delay / cancel / continuation / shouldYield 帧预算
```

下一篇预告：**Lane 模型全量**——31 位掩码的完整泳道表（SyncLane/InputContinuousLane/DefaultLane/TransitionLanes…）、getNextLanes 如何排除 suspended、lane 的过期与饥饿重调度。