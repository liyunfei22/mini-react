---
title: React 源码解析 19：Suspense——child 抛一个 thenable，边界怎么优雅地「挂起」
summary: 第 19 章装最后一台大件：Suspense。child 渲染时抛一个 promise，reconciler 沿 return 链找最近的 Suspense 边界、markRootSuspended、渲染 fallback，promise resolve 后 wake 再渲染 primary。看 fallback→primary 的切换到底靠哪几处 lane 记账。
tags: [前端, React, 源码分析, Suspense]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/19-suspense/assets/cover.png
date: 2026-09-28
series: mini-react 源码解析
seriesIndex: 19
originalSource: https://github.com/liyunfei22/mini-react
draft: false
---

# 问题：数据还没好，UI 怎么体面地占位

组件里 `read(promise)` 这么一行：数据没到就**抛出一个 promise**，到了就返回数据。React 接住这个被抛出的 thenable，不是让它炸掉整个应用，而是让最近的 `<Suspense fallback={...}>` 边界「挂起」——先渲染 fallback 占位，等 promise resolve 后再切回真实内容。

这是 React 18 并发心智最标志性的一课：**render 阶段可以「没结果」，然后在 `resolve` 之后被重新唤醒。**这一章装的就是这台「抛 thenable → 挂起 → 唤醒」的机器。

## 官方实现里发生了什么

官方把这件事拆成三份分散的职责，本章 mini 版把它们各自压缩到一个函数里（见差异表），但每份职责的语义都照着官方来。

### 抛掷被接住，沿 return 链找边界

`ReactFiberWorkLoop.js` 里 `renderRootSync` / `renderRootConcurrent` 用 `do { try { workLoop } catch (thrownValue) { handleError(root, thrownValue) } } while (true)` 包住工作循环。`handleError` 沿 erroredWork 的 `return` 链往上、按 tag 逐个 `unwindWork`，直到找到能「承接」的 Suspense（或类）边界，接着调 `throwException` 把 thenable 记到边界上、标记 `ShouldCapture`，再把 `workInProgress` 回卷到边界，下一轮工作就从边界重启渲染 fallback。

### 挂起记账与唤醒

`throwException` 里对 thenable 做的事浓缩成两句：

```js
// 记录挂起：这条 lane 现在是「挂起中」，getNextLanes 会暂时排除它
markRootSuspended(root, lanes);
// 注册唤醒：thenable 一 resolve/reject，就 ping 这条 lane、重新调度
attachPingListener(root, wakeable, lanes);
```

`attachPingListener` 的 `ping` 回调本质上就是：`markRootPinged(root, wakeableLanes)` + `ensureRootIsScheduled(root)`——把「挂起中」的 lane 重新标记为「可重试」。

### 边界渲染 fallback，还是 primary

`ReactFiberBeginWork.js` 的 `updateSuspenseComponent` 用 `DidCapture`/`ShouldCapture` 这两个 flag 决定渲染哪一支：捕获了（`DidCapture`）就渲染 `fallback`，否则渲染 `children`（primary）。primary 会被包进一个 `Offscreen`（Hidden）fragment **保留在树里**，resolve 后就地复活；fallback 挂在它的 sibling 位。

## 我们动手：mini 实现

mini 版砍掉 Offscreen（挂起即丢弃 primary 子树、resolve 后从头重渲染 children），并换成 **unwind-in-place**（不丢弃整棵 wip），其余语义对齐。

### ① 接住 thenable（`ReactFiberWorkLoop.ts`）

`renderRootSync` / `renderRootConcurrent` 用 try/catch 接住抛掷，交给 `handleThenableThrow`：

```ts
function handleThenableThrow(root, thrownValue, lanes): boolean {
  if (!isThenable(thrownValue)) return false;          // 不是 thenable：交回调用方 rethrow
  let boundary = workInProgress;
  while (boundary !== null && boundary.tag !== SuspenseComponent) boundary = boundary.return;
  if (boundary === null) return false;                // 无边界可承接：原样抛回

  workInProgressRootDidSuspend = true;
  markRootSuspended(root, lanes);

  boundary.flags |= ShouldCapture;                    // 本轮:渲染 fallback

  let didWake = false;
  const wake = () => {
    if (didWake) return; didWake = true;
    markUpdateLaneFromFiberToRoot(boundary, lanes);   // 重燃 lane:边界下次渲染 primary
    markRootPinged(root, lanes);                      // 该 lane 可被 getNextLanes 捞回
    ensureRootIsScheduled(root);
  };
  thrownValue.then(wake, wake);

  workInProgress = boundary;                          // 回卷到边界
  return true;
}
```

回卷后重新从边界开始，`workLoopSync` 走一遍 `updateSuspenseComponent`（判定 `ShouldCapture` 成立 → 渲染 fallback），就完成了「同一轮渲染里先 primary 后 fallback」的切换——不再问 `shouldYield`（官方挂起后同样回退同步）。

### ② 边界分流（`ReactFiberBeginWork.ts`）

```ts
function updateSuspenseComponent(current, workInProgress, renderLanes) {
  const nextProps = workInProgress.pendingProps;
  if ((workInProgress.flags & ShouldCapture) !== NoFlags) {
    workInProgress.flags &= ~ShouldCapture;
    workInProgress.flags |= DidCapture;
    workInProgress.deletions = null; workInProgress.flags &= ~ChildDeletion;  // 防二次删除
    reconcileChildren(current, workInProgress, nextProps.fallback ?? null, renderLanes);
  } else {
    reconcileChildren(current, workInProgress, nextProps.children ?? null, renderLanes);
  }
  return workInProgress.child;
}
```

`beginWork` 早退 prologue 里多了一个守卫：`ShouldCapture` 命中时，即使 props 没变、lanes 已清，也要放行到 `updateSuspenseComponent` 去渲染 fallback——否则回卷后的边界会被第 18 章的 bailout 直接整段跳过。

### ③ 挂起 lane 的 commit 记账（`ReactFiberCommitWork.ts`）

关键在 commit：挂起的 lane 不能像普通 lane 那样从 `pendingLanes` 抹掉，否则 wake 的 `ping` 就没了 target，会变成「resolve 了也永远切不回 primary」：

```ts
const remainingLanes = mergeLanes(
  removeLanes(root.pendingLanes, lanes),
  root.suspendedLanes & lanes,          // 仍挂起的 lane 保留在 pending
);
const suspendedLanes = root.suspendedLanes;
markRootFinished(root, remainingLanes);
root.suspendedLanes = suspendedLanes & root.pendingLanes;   // markRootFinished 会清空,恢复之
```

同步路径 `performSyncWorkOnRoot` 的 `finally` 也有一处配合：只有「抛错未 commit」时才 `removeLanes` 清账，commit 成功路径不再重复抹（否则会误删挂起 lane）。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 挂起后的 primary | 包进 Offscreen（Hidden）fragment 保留，resolve 后就地复活 | 直接丢弃，resolve 后从头重渲染 children |
| 挂起时机模型 | 并发：transition 下 primary 先留在屏上、延迟显示 fallback | legacy 风格：挂起即切 fallback（无计时/延迟） |
| 抛掷处理 | `throwException` + `unwindWork` + 独立二段 renderRoot | `handleThenableThrow` 回卷 + 同轮渲染 fallback |
| 边界 flag | `DidCapture` + `ShouldCapture`（脱水/重试路径再用） | 仅 `ShouldCapture`（`DidCapture` 只做语义记录） |
| React.lazy / SuspenseList / use() | 有 | 未实现（thenable 抛掷即本章演示的「use 心智模型」） |
| 多边界并发挂起 | 每条 lane 独立挂起/重试 | 锚定 root 级 `suspendedLanes` 的 lane 粒度 |

## 验证

```bash
pnpm test                 # suspense.test.ts 4 例
pnpm playground:dev       # Demo08：点按钮 → loading… → 800ms 后切回 primary
```

四条测试分别钉死：fallback→primary 切换、挂起后不忙循环（resolve 前渲染计数不涨）、无边界时 thenable 原样抛出、嵌套边界命中「最近」边界。演示台 `apps/playground/src/demos/08-suspense` 用 800ms 的 `setTimeout` promise 把这条链路可视化。

全量：`pnpm check` 全绿（typecheck → test → build 16 产物 → playground build）。

到这里，「从 createElement 到并发渲染，再到 Suspense」的全链闭环。剩下最硬的一块——scheduling profiler——连同 React.lazy / SuspenseList，作为延伸阅读留给想继续深挖的读者。