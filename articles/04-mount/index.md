---
title: React 源码解析 04：首屏挂载——递归渲染如何变成一趟可遍历的 Fiber 游标
summary: 从 createRoot().render() 一路走到真实 DOM：workLoopSync 怎么用一个游标替代递归、beginWork 怎么把 element 变成 fiber 子树、completeWork 怎么自底向上造 DOM 实例、commit 又怎么一次性把整棵树插进容器。
tags: [前端, React, 源码分析, Fiber]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/04-mount/assets/cover.png
date: 2026-09-22
series: mini-react 源码解析
seriesIndex: 4
originalSource: https://github.com/liyunfei22/mini-react
draft: true
---

# 问题：`createRoot(container).render(<App/>)` 之后发生了什么

上一章我们有了 Fiber 节点（三指针链表树），但它是"死"的——没有东西去遍历它、没有东西把它落到 DOM。这一章回答的是 React 世界的第一个头号问题：

> 从一句 `render()` 到屏幕上出现字，中间到底走了哪条路？

答案是一条清晰的流水线：**调度 → render（beginWork/completeWork）→ commit**。我们逐段拆。

## 官方实现里发生了什么

官方这条链路的四段（`ReactFiberWorkLoop.old.js` 为主）：

```js
// 1) 同步渲染主循环：一个 while + 一个游标，没有递归、没有调用栈
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 2) 每个"工作单元"：beginWork 产子 fiber，决定往下走还是向上收口
function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;
  let next = beginWork(current, unitOfWork, subtreeRenderLanes);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) completeUnitOfWork(unitOfWork);
  else workInProgress = next;
}

// 3) 收口：completeWork 自底向上建 DOM，再沿 sibling/return 漂移
function completeUnitOfWork(unitOfWork) {
  let completedWork = unitOfWork;
  do {
    const returnFiber = completedWork.return;
    let next = completeWork(completedWork.alternate, completedWork, ...);
    if (next !== null) { workInProgress = next; return; }
    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) { workInProgress = siblingFiber; return; }
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}
```

`beginWork` 里，HostRoot / 组件 / host 标签各有分支，但共同点是调用 `reconcileChildren` 把 children（element）变成子 fiber 链。而 `completeWork` 对 HostComponent 调 `createInstance` 建 DOM 节点，再用 `appendAllChildren` 把已建好的子实例挂进去——这就是为什么它必须**自底向上**：父亲要等孩子的实例先出炉。

最后 commit 阶段（`ReactFiberCommitWork`），带 `Placement` 的那一个"根底下子节点"被 `insertOrAppendPlacementNode` 一次性插进容器——整棵子树因为 completeWork 已经拼好，插这一个就够了。

## 我们动手：mini-实现

仓库 `packages/react-reconciler/src/` 新增五块：

| 文件 | 对应官方 | 职责 |
| --- | --- | --- |
| `ReactFiberWorkLoop.ts` | ReactFiberWorkLoop | workLoopSync / performUnitOfWork / completeUnitOfWork / renderRootSync / scheduleUpdateOnFiber |
| `ReactFiberBeginWork.ts` | ReactFiberBeginWork | beginWork 分发（HostRoot/FunctionComponent/HostComponent/HostText） |
| `ReactFiberCompleteWork.ts` | ReactFiberCompleteWork | completeWork 建 host 实例 + appendAllChildren |
| `ReactChildFiber.ts` | ReactChildFiber | ChildReconciler：element → 子 fiber（挂载路径） |
| `ReactFiberCommitWork.ts` + `ReactFiberSyncTaskQueue.ts` | ReactFiberCommitWork / SyncTaskQueue | commit（Placement）+ 同步调度队列 |

几个刻意简化、但保留了"灵魂"的地方：

- **无 hooks 的函数组件**：`updateFunctionComponent` 直接 `Component(props)`（ReactCurrentDispatcher 第 6 章才出现）。
- **同步调度**：`scheduleUpdateOnFiber` 走 `queueMicrotask(flushSyncCallbacks)`，没有 Scheduler（第 14 章）。
- **commit 只做 Placement**：三阶段中先实现 Mutation；before/layout 第 5 章。

## 一个非死记不可的细节：marking Placement 的边界

为什么整棵树只有"根底下第一个组件"打了 `Placement`，其余都不打？

```ts
// reconcileChildren 的官方语义：只看 current === null
if (current === null) {
  workInProgress.child = mountChildFibers(...);   // 全新子树：不打标记
} else {
  workInProgress.child = reconcileChildFibers(...); // 顶层：placeSingleChild 打 Placement
}
```

因为宿主子树在 `completeWork` 里已经拼成一整颗实例树（`appendAllChildren`），commit 时把这个"带 Placement"的根节点挂进容器即可，其余全部跟着进来。**谁也不需要为每个叶子都打标**——这是 React 用一块 Placement 换掉一树干标记的性能巧思。我们写测试时被这个细节反复教育：一开始在 `reconcileChildren` 里多判断了 `current.child === null`，结果没人打 Placement、commit 找不到可插入的节点，树永远渲染不出来。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| workLoop | workLoopSync / workLoopConcurrent | 只 workLoopSync（并发第 16 章） |
| 调度 | Scheduler + Lane 优先级 | 同步 microtask + SyncLane |
| 入队 | UpdateQueue.enqueueUpdate | root.current.pendingProps 直传（第 6 章换 UpdateQueue） |
| beginWork 分支 | 十余种 tag | HostRoot / Function / Host 三大类 |
| 组件渲染 | renderWithHooks + dispatcher | 直接调用组件函数 |

## 验证

```bash
pnpm test                    # mount.test.ts：函数组件/多子/数字归一化/双缓冲切换
pnpm playground:dev          # 打开 http://localhost:5173 看 Demo02
node scripts/build.js react-dom  # react-dom 产物从 2KB 涨到 ~21KB（reconciler 内联进来了）
```

下一篇预告：**提交阶段的三阶段**（BeforeMutation / Mutation / Layout）与 `root.current` 交换时机——为什么 React 要在 mutation 之后、layout 之前才换树。