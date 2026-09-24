---
title: React 源码解析 16：并发渲染——把 Scheduler、Lane、useTransition 接成一台可中断的机器
summary: 前 15 章装好的零件终于在这一章组装起来：ensureRootIsScheduled 的并发分支把 non-sync lane 交给 Scheduler、workLoopConcurrent 每个工作单元都问 shouldYield、startTransition 让更新走 transition 泳道异步渲染。到这一刻，mini-react 的渲染才真正可中断。
tags: [前端, React, 源码分析, 并发]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/16-concurrent/assets/cover.png
date: 2026-09-24
series: mini-react 源码解析
seriesIndex: 16
originalSource: https://github.com/liyunfei22/mini-react
draft: true
---

# 问题：一条 setState 到底走"同步"还是"并发"

前 15 章都在为这一章铺路，答案此刻揭晓：**看它分到的 lane 是不是 sync**。

```js
function requestUpdateLane(fiber) {
  // ① transition / useDeferredValue 包裹 → transition 泳道（并发）
  if (ReactCurrentBatchConfig.transition !== null) {
    return claimNextTransitionLane();
  }
  // ② flushSync 的显式优先级 → SyncLane
  if (currentUpdatePriority !== NoLane) return currentUpdatePriority;
  // ③ 默认（离散事件）→ SyncLane
  return SyncLane;
}
```

拿到 lane 后，`ensureRootIsScheduled` 分派：

```js
if (includesSyncLane(nextLanes)) {
  scheduleSyncCallback(performSyncWorkOnRoot);   // 同步：microtask 统一 flush
} else {
  const priority = lanesToSchedulerPriority(nextLanes);
  unstable_scheduleCallback(priority, performConcurrentWorkOnRoot);  // 并发：调度器排队
}
```

于是：普通点击 setState → SyncLane → 同步；`startTransition` 里的 setState → TransitionLane → 并发（异步、可中断）。

## 官方实现里发生了什么

并发渲染的"可中断"，核心就是 `workLoopConcurrent` 与同步版的**一行差别**：

```js
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {  // ← 每单元都问"该让了吗"
    performUnitOfWork(workInProgress);
  }
}
```

`shouldYield` 来自 Scheduler 的 `unstable_shouldYield`（5ms 帧预算）。时间片用尽 → 中断 → 把"没渲染完的 wip 树"直接丢弃（因为 current 树原封不动，这就是第 3 章双缓冲的意义）→ 回到事件循环 → 下一片从 `performConcurrentWorkOnRoot` 继续。

`performConcurrentWorkOnRoot(root, didTimeout)` 决定这轮是"切片"还是"一口气跑完"：

```js
const shouldTimeSlice =
  !includesBlockingLane(lanes) &&   // 不是阻塞优先级
  !includesExpiredLane(root, lanes) && // 未过期（饥饿保护）
  !didTimeout;                        // 调度器没宣告超时
```

## 我们动手：mini-实现

| 文件 | 新增 |
| --- | --- |
| `ReactFiberWorkLoop.ts` | `workLoopConcurrent` / `renderRootConcurrent` / `performConcurrentWorkOnRoot` / `lanesToSchedulerPriority` / `flushSync` / `getCurrentUpdatePriority` |
| `ReactFiberHooks.ts` | `mount/updateTransition`、`mount/updateDeferredValue`；`processUpdateQueue` 按 `renderLanes` 过滤更新 + `baseQueue` 重基准（lane 真正进入更新队列的分水岭，官方同款） |
| `react` / `react-dom` | `useTransition` / `useDeferredValue` / `flushSync` 导出 |

## 已验证的两个可观察行为

1. **`startTransition(() => setValue(1))` 之后、哪怕冲刷掉全部 microtask，DOM 仍是旧值**——因为 transition 泳道走并发调度、经 Scheduler 的宏任务才渲染。这里的判别点很关键：`useTransition` 收尾时那个 `setPending(false)` 是 sync lane，会触发一次 sync 渲染；若更新队列不做 lane 过滤，它会把 `setValue(1)` 一并吞掉，DOM 提前在 microtask 就变成 1（假异步）。`processUpdateQueue` 按 `renderLanes` 过滤后，这条 transition 更新被跳过、留到宏任务才落地——所以"microtask 之后仍旧值"和"宏任务之后变 1"同时成立，才是真异步。而 `flushSync(() => setValue(5))` 之后 DOM **立即**是 5。
2. 这是 React 18「可中断渲染」最直观的分野：**普通更新阻塞、transition 更新不阻塞**。

## 差异对照表（也是本系列的收官"自白"）

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| isPending 时机 | 过渡渲染 commit 后才清 | 同步结束后即清（简化） |
| useDeferredValue | 专用 transition + peekValue | useState + transition effect 近似 |
| 事件优先级→lane 桥接 | getCurrentUpdatePriority 全接 | 默认回落 SyncLane |
| 并发"中断恢复" | 完整（finish、ping、重试） | 允许中断 + 续排（Suspense 无） |

## 验证

```bash
pnpm test    # concurrent.test.ts：useTransition 异步 / flushSync 同步
```

---

## 系列结语

到这里，17 篇文章（00~16）走完了从 `createElement` 到并发渲染的全程。回头看这条主线，其实只有四个词：

**描述（element）→ 构造（render/fiber）→ 提交（commit）→ 调度（lane/scheduler）**。

真正让 React 与众不同的，是它们在"可中断"上做的所有功课——Fiber 链表、双缓冲、Lane 位掩码、MessageChannel 时间切片——每一个都朴素，但环环相扣。现在你可以打开 `node_modules/react-dom/cjs/react-dom.development.js`，对着本仓库 `packages/*` 逐行 diff 了。