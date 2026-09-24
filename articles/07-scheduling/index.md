---
title: React 源码解析 07：setState 之后的调度——requestUpdateLane 与 ensureRootIsScheduled
summary: 一次 dispatch 到底做了什么才让 React 重新渲染？拆开调度中枢：requestUpdateLane 定优先级、markRootUpdated 打标、ensureRootIsScheduled 按"是否同步 lane"分派到同步或并发路径，以及它为什么用 callbackNode 而不是 lane 位来判断"是否已调度"。
tags: [前端, React, 源码分析, 调度]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/07-scheduling/assets/cover.png
date: 2026-09-22
series: mini-react 源码解析
seriesIndex: 7
originalSource: https://github.com/liyunfei22/mini-react
draft: true
---

# 问题：dispatch 和"重新渲染"之间，隔着一个什么

第 6 章我们看到 `setCount(c => c+1)` 最终会更新 DOM。但它中间到底经过了哪些"调度"步骤？本章把这段**被很多人跳过的中间层**摊开：

```
dispatch → requestUpdateLane（定优先级）→ scheduleUpdateOnFiber
        → markRootUpdated（打标）→ ensureRootIsScheduled（分派路径）
        → scheduleSyncCallback / scheduleCallback → 渲染 → commit
```

## 官方实现里发生了什么

`ReactFiberWorkLoop.old.js` 的三段（浓缩）：

```js
export function scheduleUpdateOnFiber(root, fiber, lane, eventTime) {
  markRootUpdated(root, lane, eventTime);   // ① pendingLanes |= lane
  ensureRootIsScheduled(root, eventTime);   // ② 决定"怎么调度"
}

function ensureRootIsScheduled(root, currentTime) {
  markStarvedLanesAsExpired(root, currentTime);
  const nextLanes = getNextLanes(root, workInProgressRootRenderLanes);
  const newCallbackPriority = getHighestPriorityLane(nextLanes);
  if (includesSyncLane(newCallbackPriority)) {
    // 同步：进 syncQueue，microtask 统一 flush
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    scheduleMicrotask(flushSyncCallbacks);
  } else {
    // 并发：交给 Scheduler 按优先级排队
    const schedulerPriorityLevel = lanesToEventPriority(nextLanes);
    newCallbackNode = scheduleCallback(schedulerPriorityLevel, performConcurrentWorkOnRoot.bind(null, root));
  }
  root.callbackNode = newCallbackNode;
  root.callbackPriority = newCallbackPriority;
}
```

而优先级从哪来？`requestUpdateLane(fiber)`：

```js
function requestUpdateLane(fiber) {
  const mode = fiber.mode;
  if ((mode & ConcurrentMode) === NoMode) return SyncLane;      // legacy
  if ((executionContext & RenderContext) !== NoLanes && workInProgressRootRenderLanes !== NoLanes) {
    return pickArbitraryLane(workInProgressRootRenderLanes);    // 渲染期中触发的更新
  }
  // …transition 取 TransitionLanes，否则读当前事件优先级
}
```

## 一个必须想清楚的判断：为什么用 callbackNode 而不是 lane 位

早期（本仓库第 4~6 章）我用过一个偷懒的守卫：

```ts
if ((root.pendingLanes & lane) !== 0) return;  // ❌ 用它判断"是否已调度"
```

这有两个坑：

1. **lane 位是"状态"，不是"是否已调度"**。pendingLanes 里已经有该 lane，只能说明"有待处理工作"，不能说明"已经在执行中"。用位判断会导致**渲染抛错后 pendingLanes 卡死、后续更新被吞**（第 6 章踩过）。
2. **多 lane 时它不成立**：SLane 已在 pending，再来一个更高优先级的 lane，`(pending & lane) !== 0` 对那个新 lane 是 false 所以会继续——但"合并/复用"的语义应该由 callback 优先级决定。

官方用 `root.callbackNode`（当前挂着的调度任务）+ `callbackPriority` 判断：**优先级没变且已有任务 → 复用；优先级变了 → 取消旧的重新调度**。这才是"是否已调度"的正确判断。

## 我们动手：mini-实现

`packages/react-reconciler/src/`：

| 文件 | 新增 |
| --- | --- |
| `ReactFiberLane.ts` | `getNextLanes` / `includesSyncLane` / `mergeLanes` / `removeLanes` / `NoTimestamp` |
| `ReactFiberWorkLoop.ts` | `requestUpdateLane`、`ensureRootIsScheduled`（callbackNode 复用）、把小 lane 线程化进 `renderRootSync(workLoopSync(renderLanes))` |

同步路径长这样（mini 版）：

```ts
function ensureRootIsScheduled(root) {
  const nextLanes = getNextLanes(root);
  if (nextLanes === NoLanes) return;
  const newCallbackPriority = getHighestPriorityLane(nextLanes);
  if (includesSyncLane(newCallbackPriority)) {
    if (root.callbackNode === null || root.callbackPriority !== newCallbackPriority) {
      scheduleSyncCallback(() => performSyncWorkOnRoot(root));
      scheduleMicrotask(flushSyncCallbacks);
      root.callbackPriority = newCallbackPriority;
      root.callbackNode = {};
    }
  } else {
    throw new Error('并发调度尚未实现（第 14~16 章）');
  }
}
```

第 7 章 `requestUpdateLane` 只返回 `SyncLane`（没有事件系统/transition），但函数骨架、`ensureRootIsScheduled` 的分派结构、`markRootUpdated`/`getNextLanes` 都已就位——第 14~16 章只需往里填 Scheduler 与完整 lane 表。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| requestUpdateLane | legacy/render-phase/transition/event 四路 | 恒 SyncLane（注释里留好四路） |
| ensureRootIsScheduled | sync + concurrent 双分支 | sync 分支；并发分支 stub（throw） |
| getNextLanes | 排除 suspended、按优先级 | 直接返回 pendingLanes（第 15 章） |
| markStarvedLanesAsExpired | 有 | 无（第 15 章） |
| commit 清 lane | 只清 finishedLanes | 只清 finishedLanes（已对齐） |

## 验证

```bash
pnpm test    # commit.test.ts 调度组：同批多次 updateContainer 只渲染一次（callbackNode 复用）
```

下一篇预告：**Reconciliation / Diff**——key 心智模型、多节点数组的复用与移动，以及 `lastPlacedIndex` 如何判断一个节点该"复用"还是"移动"。