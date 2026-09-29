---
title: React 源码解析 18：bailout——父组件重渲染时，没变的子树凭什么可以跳过
summary: 第 18 章补上那张一直缺的「跳过」开关：beginWork 早退、childLanes 只沿祖先链上冒、cloneChildFibers 原样续钻、被跳过的 lane 重新点回。去掉「整树重渲染」这条已知简化，让 mini-react 首次有了 React.memo 同款的节省。
tags: [前端, React, 源码分析, Fiber]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/18-bailout/assets/cover.png
date: 2026-09-28
series: mini-react 源码解析
seriesIndex: 18
originalSource: https://github.com/liyunfei22/mini-react
draft: false
---

# 问题：父组件 setState，兄弟子树凭什么要跟着重渲染

前面 17 章，mini-react 一直带着一条白纸黑字的简化：**无 bailout，整树重渲染**——任何一个组件的 `setState`，都会让整棵 Fiber 树从头走到尾，每个函数组件都被重新调用一遍。

这不是 React 的实际表现。真实 React 里，更新 A 的 state，同层的 B 组件**根本不会被调用**。省掉的不是一次函数调用那么简单，而是一整条「render body → reconcile children → diff」的链路。这一章就把这个「跳过」的机关装上。

一句话先给结论：**「跳不跳」看两个位掩码的交集——自己身上的 `lanes`，和祖先链上的 `childLanes`。**前者决定「我自己要不要重跑」，后者决定「我的子树里还有没有活」。

## 官方实现里发生了什么

这套机制散在三个文件、五六个函数里，但主心骨就两条。

### 账本：谁有活，沿着 return 链往上记

一次状态更新发生在一个具体的 fiber 上。`ReactFiberConcurrentUpdates.js` 的 `markUpdateLaneFromFiberToRoot` 把这条 lane **点燃到两个地方**：

```js
function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);       // ① 自己：我有活
  let alternate = sourceFiber.alternate;
  if (alternate !== null) alternate.lanes = mergeLanes(alternate.lanes, lane);

  let parent = sourceFiber.return;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);     // ② 祖先：我子树有活
    alternate = parent.alternate;
    if (alternate !== null) alternate.childLanes = mergeLanes(alternate.childLanes, lane);
    parent = parent.return;
  }
}
```

注意它**只沿 `return` 链往祖先走**，兄弟子树碰都不碰。这就是「更新 A、跳过 B」成立的地基——B 以及 B 的整条祖先链上，没有任何一位被点上。对应官方 `ReactFiberConcurrentUpdates.new.js`（官方还把它延迟到 `finishQueueingConcurrentUpdates` 批量执行；见差异表）。

### 早退：beginWork 顶部先问一句「我还要不要干」

`ReactFiberBeginWork.js` 的 `beginWork` 在做任何正事之前，先看三件事（`oldProps !== newProps` 废话就不展开了）：

```js
if (current !== null) {
  const oldProps = current.memoizedProps;
  const newProps = workInProgress.pendingProps;
  if (oldProps !== newProps || hasLegacyContextChanged()) {
    didReceiveUpdate = true;
  } else {
    const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
    if (!hasScheduledUpdateOrContext && (workInProgress.flags & DidCapture) === NoFlags) {
      didReceiveUpdate = false;
      return attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes);
    }
    didReceiveUpdate = false;
  }
}
workInProgress.lanes = NoLanes;   // 确定要干活：先清账
```

`checkScheduledUpdateOrContext` 只查一件事：

```js
function checkScheduledUpdateOrContext(current, renderLanes) {
  const updateLanes = current.lanes;
  if (includesSomeLane(updateLanes, renderLanes)) return true;
  // …惰性 context 传播被 enableLazyContextPropagation 关掉时到此为止
  return false;
}
```

而真正决定「跳过整段」还是「克隆续钻」的是 `bailoutOnAlreadyFinishedWork`：

```js
function bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes) {
  if (current !== null) workInProgress.dependencies = current.dependencies;
  markSkippedUpdateLanes(workInProgress.lanes);
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    return null;                    // 子树也没活：整段跳过
  }
  cloneChildFibers(current, workInProgress);   // 子树有活：原样克隆孩子，继续往下钻
  return workInProgress.child;
}
```

`cloneChildFibers`（`ReactChildFiber.js`）是关键细节：它用 `createWorkInProgress(currentChild, currentChild.pendingProps)` 把每个孩子克隆成 wip，**pendingProps 原样带过去**——于是孩子的 beginWork 会命中「props 没变」分支，各自再判断该不该继续，从而实现「只钻到真正有活的那一支」。

### 第三块暗账：被跳过的 lane 要重新点回

光有上面两条，有个场景会出 bug：**组件的过渡更新被一次 sync 渲染跳过之后，lanes 被清、props 又没变，下一次过渡渲染会把它整段 bailout 掉、更新丢失。**官方的答案在 `ReactFiberHooks.js` 的 `updateReducer` 里，跳过低优先级更新时：

```js
currentlyRenderingFiber.lanes = mergeLanes(currentlyRenderingFiber.lanes, updateLane);
markSkippedUpdateLanes(updateLane);
```

被跳过的 lane 重新点回 fiber 自己的 `lanes`。

## 我们动手：mini 实现

mini 版按三条主线一一对齐核心，去掉了 `didReceiveUpdate`、`React.memo` 的浅比较、惰性 context 传播这些分支（差异见下表），但三条主线原样保留。

### ① 账本（`ReactFiberWorkLoop.ts`）

```ts
export function markUpdateLaneFromFiberToRoot(sourceFiber: FiberNode, lane: Lane): FiberRootNode {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  let alternate = sourceFiber.alternate;
  if (alternate !== null) alternate.lanes = mergeLanes(alternate.lanes, lane);
  let parent = sourceFiber.return;
  let node = sourceFiber;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    alternate = parent.alternate;
    if (alternate !== null) alternate.childLanes = mergeLanes(alternate.childLanes, lane);
    node = parent;
    parent = parent.return;
  }
  return node.stateNode as FiberRootNode;
}

export function scheduleUpdateOnFiber(root, fiber, lane): void {
  markUpdateLaneFromFiberToRoot(fiber, lane);
  markRootUpdated(root, lane, unstable_now());
  ensureRootIsScheduled(root);
}
```

### ② 早退（`ReactFiberBeginWork.ts`）

```ts
function checkScheduledUpdateOrContext(current: FiberNode, renderLanes: Lanes): boolean {
  return includesSomeLane(current.lanes, renderLanes);
}

function bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes): FiberNode | null {
  if (current !== null) workInProgress.dependencies = current.dependencies;
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) return null;
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}

export function beginWork(current, workInProgress, renderLanes): FiberNode | null {
  if (current !== null) {
    const propsChanged = current.memoizedProps !== workInProgress.pendingProps;
    if (!propsChanged) {
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(current, renderLanes);
      if (!hasScheduledUpdateOrContext) {
        return attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress, renderLanes);
      }
    }
  }
  workInProgress.lanes = NoLanes;
  switch (workInProgress.tag) { /* … */ }
}
```

`cloneChildFibers` 落在 `ReactChildFiber.ts`，与官方 `ReactChildFiber.new.js` 逐行一致。

### ③ 暗账（`ReactFiberHooks.ts` 的 `processUpdateQueue`）

```ts
before: queue.lanes = mergeLanes(queue.lanes, updateLane);
  之后加一行:
after:  currentlyRenderingFiber!.lanes = mergeLanes(currentlyRenderingFiber!.lanes, updateLane);
```

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| `didReceiveUpdate` | 有，驱动 React.memo 的浅比较与类组件 | 无（mini 无 React.memo / 类组件），直接 props 引用比较 |
| 惰性 context 传播 | `checkIfContextChanged` 查依赖，可跳过只订阅 context 的消费者 | 无：ContextProvider 恒走全量 `updateContextProvider`，靠重渲染级联传新值 |
| childLanes 上冒时机 | `enqueueUpdate` 立即点 fiber.lanes；childLanes 延迟到 `finishQueueingConcurrentUpdates` | 即时上冒（mini 渲染期更新直接抛错，无并发事件插入） |
| `markSkippedUpdateLanes` 全局 | 记录到 `workInProgressRootSkippedLanes`，供 Suspense 延迟 / 错误边界用 | 省略（第 19 章 Suspense 用不上这条路径） |
| bailout 能力 | memo 可依据浅比较跳过；普通函数组件同款早退 | 普通函数组件早退齐备；memo 浅比较缺失 |

## 验证

```bash
pnpm test   # bailout.test.ts 3 例：兄弟跳过 / 子树整段跳过 / 跳过 lane 重标记
```

三条测试分别钉死三个断言：

- **兄弟跳过**：`A`/`B` 同层，`flushSync(() => setA(1))` 后 `bRenders` 仍为 1（B 的 render body 没被调用）。
- **子树整段跳过**：`B` 内嵌 `C`，更新 A 后 `bRenders`、`cRenders` 都不涨。
- **跳过 lane 重标记**：给 `Child` 挂 transition 更新、再给 `Parent` 挂 sync 更新，sync 连带重渲染时跳过 transition，之后 transition 渲染仍能把 Child 的更新落地——没有「暗账 ③」这条会整段 bailout 丢失。

全量：`pnpm check` 全绿（typecheck → test → build 16 产物 → playground build）。

下一章预告：**Suspense**——bailout 的「跳过」是锦上添花的性能，Suspense 的「挂起」才是 React 18 加持并发水合的心智拐点：child 抛一个 thenable，边界渲染 fallback，promise resolve 后再唤醒 primary。