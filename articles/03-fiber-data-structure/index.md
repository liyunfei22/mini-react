---
title: React 源码解析 03：Fiber 数据结构——为什么 React 用链表代替递归，以及双缓冲的妙处
summary: 递归渲染为什么在 React 18 里被判了死刑？Fiber 的 child/sibling/return 三指针如何让遍历可中断、可恢复；current 与 workInProgress 两棵树互为 alternate 的双缓冲，如何一边渲染一边让屏幕保持稳定。
tags: [前端, React, 源码分析, Fiber, 算法]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/03-fiber-data-structure/assets/cover.png
date: 2026-09-22
series: mini-react 源码解析
seriesIndex: 3
originalSource: https://github.com/liyunfei22/mini-react
draft: true
---

# 问题：为什么 React 16 之前的渲染方式是"一条死路"

最早的 React 渲染是一个**递归**过程：`mountComponent` 递归调用自己，把整棵虚拟 DOM 树一口气走完。

```js
// 递归渲染（React 15 及以前的心智模型）
function mountComponent(node) {
  const el = document.createElement(node.type);
  node.children.forEach((child) => el.appendChild(mountComponent(child)));
  return el;
}
```

递归有两个致命问题：

1. **一旦开始就不能中断**。一整棵大树在 JS 主线程里同步走完，中间不断不能让出给浏览器——树一大，页面就掉帧。
2. **无法按优先级恢复**。递归调用栈是"函数栈"，没法保存现场、换个时间接着走。

React 18 的答案是 **Fiber**：把"递归的调用栈"显式地变成**一条可以在内存里自由摘除/挂回的链表**，于是渲染可以被拆成一个个小任务、随时暂停、按优先级恢复。

## 官方实现里发生了什么

Fiber 节点（`ReactFiber.old.js`）本质是一个有很多字段的对象，其中树结构靠三根指针：

```js
function FiberNode(tag, pendingProps, key, mode) {
  // Instance
  this.tag = tag; this.key = key;
  this.elementType = null; this.type = null; this.stateNode = null;
  // Fiber 树结构 —— 三指针
  this.return = null; this.child = null; this.sibling = null;
  this.index = 0; this.ref = null;
  // 渲染数据
  this.pendingProps = pendingProps; this.memoizedProps = null;
  this.updateQueue = null; this.memoizedState = null; this.dependencies = null;
  // 调度与副作用
  this.mode = mode;
  this.flags = NoFlags; this.subtreeFlags = NoFlags; this.deletions = null;
  this.lanes = NoLanes; this.childLanes = NoLanes;
  this.alternate = null;   // ← 双缓冲的关键
}
```

`return` + `child` + `sibling` 把一棵树编码成"链表树"：`child` 指向第一个儿子，儿子之间用 `sibling` 串起来，每个节点都能通过 `return` 回到父亲。于是用一个 `workInProgress` 游标就能迭代遍历，不再依赖函数调用栈。

双缓冲的关键在 `createWorkInProgress`（官方同名函数）：

```js
function createWorkInProgress(current, pendingProps) {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    // 首次：全新分配，互相指向对方
    workInProgress = createFiber(current.tag, pendingProps, current.key, current.mode);
    workInProgress.alternate = current;   // 新 → 旧
    current.alternate = workInProgress;   // 旧 → 新
  } else {
    // 复用：只重置"本轮临时状态"
    workInProgress.pendingProps = pendingProps;
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }
  // 快照拷贝 + 保留静态 flag
  workInProgress.flags = current.flags & StaticMask;
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  // ...dependencies 浅拷贝避免共享…
  return workInProgress;
}
```

从此渲染不再"改"当前显示的树，而是**在一棵 shadow 树上改**，改完一次性换指针。

## 我们动手：mini-实现

仓库 `packages/react-reconciler/src/` 新增六个文件：

| 文件 | 对应官方 | 内容 |
| --- | --- | --- |
| `ReactWorkTags.ts` | ReactWorkTags.js | 数字常量条约（HostRoot=3、HostComponent=5…） |
| `ReactFiberFlags.ts` | ReactFiberFlags.js | 副作用位标志 + Mutation/Passive/Layout/Static 掩码 |
| `ReactFiberLane.ts` | ReactFiberLane.js | 最小 lane 定义（第 15 章扩完整模型） |
| `ReactFiber.ts` | ReactFiber.old.js | FiberNode + createWorkInProgress 双缓冲 |
| `ReactFiberRoot.ts` | ReactFiberRoot.old.js | FiberRootNode + createFiberRoot + 双向指认 |
| `DebugFiber.ts` | （官方用 DevTools） | 手写阶段的树打印器 |

`createWorkInProgress` 的核心逻辑与官方一字未差的语义（TS 版）：

```ts
// 复用分支：重置临时状态
workInProgress.flags = NoFlags;
workInProgress.subtreeFlags = NoFlags;
workInProgress.deletions = null;
// … 统一快照拷贝 + 保留静态 flag
workInProgress.flags = current.flags & StaticMask;
```

测试里最有趣的一条是"ping-pong"：模拟 commit 交换指针后，下一轮 wip 复用的正是上一轮的 current：

```ts
const wip = createWorkInProgress(current, null); // 第一轮
root.current = wip;                               // 模拟 commit
const wip2 = createWorkInProgress(root.current, null);
expect(wip2).toBe(current); // ← 旧树被复用，不是重新 new
```

## 双缓冲到底"妙"在哪？

把"显示中"与"绘制中"拆成两棵树（`current` 与 `workInProgress`，互为 `alternate`），带来的三个收益：

1. **屏幕永远稳定**：渲染过程里所有改动都落在 wip 树上，`current` 原封不动；即便这轮渲染被高优先级打断、整棵 wip 丢弃，屏幕上的 `current` 依然完好。
2. **无分配压力**：每轮复用 `alternate` 现成对象，不反复 `new`，也就没有 GC 抖动。
3. **切换只需一次指针赋值**：commit 阶段 `root.current = finishedWork` 一行搞定，第 5 章会看到这个"换指针即切换"的完整动作。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| FiberNode 字段 | 全量（含 profiler/子树计时等） | 教学精简：保留树结构/渲染/调度三组核心字段 |
| Lane 模型 | 完整 31 位 mask | 仅类型 + NoLanes + 两个工具（第 15 章补齐） |
| flags | 含 Hydrating/Visibility/StoreConsistency 等 | 保留 Mutation/Passive/Layout/Static 核心掩码 |
| 调试可视化 | React DevTools | `formatFiberTree` 缩进打印 |

## 验证

```bash
pnpm test   # fiber.test.ts：形状 / alternate 复用 / 双缓冲 ping-pong / 调试打印
```

下一章：`beginWork` / `completeWork` 与"递归变迭代"的完整渲染循环。