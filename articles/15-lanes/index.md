---
title: React 源码解析 15：Lane 模型——优先级怎么编码进一个 31 位数里
summary: React 怎么用一个 number 同时表达"有哪几种优先级的活要干"？拆开 31 位泳道表：SyncLane/DefaultLane/TransitionLanes 的位值、位运算工具、getNextLanes 如何排除 suspended、以及 markStarvedLanesAsExpired 的饥饿保护为何是低优先级任务不被饿死的保证。
tags: [前端, React, 源码分析, 并发, 算法]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/15-lanes/assets/cover.png
date: 2026-09-24
series: mini-react 源码解析
seriesIndex: 15
originalSource: https://github.com/liyunfei22/mini-react
draft: false
---

# 问题：更新有优先级，但怎么"记得住"同时存在好几种优先级

一次渲染期间，可能同时有：一个高优先级的点击、几个普通更新、一个低优先级的 transition。React 用一个 **31 位的 number（Lanes）** 装下所有：每一位是一条"泳道"，位为 1 表示"这条泳道上有活"。

```js
const SyncLane      = 0b0000000000000000000000000000001; // 位 0，最高优先级
const InputContinuousLane = 0b0000000000000000000000000000100; // 位 2
const DefaultLane   = 0b0000000000000000000000000010000; // 位 4
const TransitionLanes = 0b0000000001111111111111111000000; // 位 6~21，共 16 条
const IdleLane      = 0b0100000000000000000000000000000; // 位 29
```

为什么不用 React 15 的单个 `expirationTime`？因为一个 number 只能表达"最近的截止时间"，而 **Lane 能表达多个优先级叠加**：`SyncLane | DefaultLane` 表示"我既要点一下、又要刷新列表"，位运算天然支持合并、剔除、判断包含。

## 官方实现里发生了什么

ReactFiberLane.new.js 的核心是位运算，加上"根据 root 状态挑出这次该渲染的 lane"：

```js
export function getHighestPriorityLane(lanes) {
  return lanes & -lanes; // 位技巧：取出最低位的 1（数值越小优先级越高）
}

export function getNextLanes(root, wipLanes) {
  const pendingLanes = root.pendingLanes;
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;

  const nonIdlePendingLanes = pendingLanes & NonIdleLanes; // 非 idle 优先
  if (nonIdlePendingLanes !== NoLanes) {
    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes; // 排除挂起
    if (nonIdleUnblockedLanes !== NoLanes) {
      return getHighestPriorityLanes(nonIdleUnblockedLanes);
    }
    // 全挂起了？—— 用被 ping 的 lane 兜底
  }
  // …idle 场景…
}
```

**饥饿保护**在 `markStarvedLanesAsExpired`：

```js
export function markStarvedLanesAsExpired(root, currentTime) {
  let lanes = root.pendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    const expirationTime = root.expirationTimes[index];
    if (expirationTime <= currentTime) {
      root.expiredLanes |= lane; // 到期 → 即使低优先级也强制跑
    }
    lanes &= ~lane;
  }
}
```

每条 lane 都有一个"过期时间"（按优先级高低给 250ms / 5000ms / 10000ms …），一旦到期，`expiredLanes` 标记它，渲染时**不再让出**（同步跑完）。这就是低优先级任务不会被高优先级任务永远插队饿死的保证。

## 我们的一个简化：本仓库还"用不到"大部分泳道

第 15 章把 lane 模型全量落地，但当前 reconciler 的 `requestUpdateLane` 仍返回 `SyncLane`——因为事件系统的 `getCurrentEventPriority` → lane 的桥接、以及 `useTransition` 的 transition 泳道，要等第 16 章才接上。所以这章的意义在于：**把那台"多优先级机器"装好、测好**，下一章只是给它接上两根线。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 泳道表 | 全 31 位 | 全（位值逐字对齐，复核不在此章出位值错） |
| getNextLanes | 含"不打断当前渲染"的 wip 比较 | 保留核心：非 idle 优先 + 排除 suspended + pinged 兜底 |
| markRootEntangled / entanglements | 有（Suspense 用） | 字段占位（无 Suspense） |
| computeExpirationTime | 细粒度 switch | 简化：按优先级给超时 |

## 验证

```bash
pnpm test    # lane.test.ts：位运算 / 泳道数值 / getNextLanes 排除 suspended / 饥饿过期
```

下一篇预告（最后一章）：**并发升级**——`ensureRootIsScheduled` 接上 Scheduler、`workLoopConcurrent` 的 `shouldYield` 中断、`useTransition`/`useDeferredValue`/`flushSync`，以及自动批处理。到那时，playground 里的渲染才真正"可中断"。