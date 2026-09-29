---
title: React 源码解析 06：useState 为什么只是个"读 dispatcher 的函数"——hooks 运行时拆解
summary: useState 一行实现都没有，却能凭空变出状态？拆开看：ReactCurrentDispatcher 的双实现切换、按调用顺序串成的 hook 链表、dispatch 的环形 pending 队列与 eager bailout，以及这一切如何拼出"setState 相同值不重渲染"。
tags: [前端, React, 源码分析, Hooks]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/06-hooks/assets/cover.png
date: 2026-09-22
series: mini-react 源码解析
seriesIndex: 6
originalSource: https://github.com/liyunfei22/mini-react
draft: false
---

# 问题：useState 的"状态"到底存在哪、怎么被记住

调用 `useState` 的函数组件，既没有 `this`、也不是类——它凭什么在下一次 render 时"想起"上一次的值？答案是两层机制：

1. **ReactCurrentDispatcher 双实现**：`useState` 这个函数本身是"空的"，只是读当前 dispatcher 再转发；
2. **hook 链表**：状态记在 fiber 的 `memoizedState` 上，按调用顺序串成链表——顺序恒定，所以"记得住"。

## 官方实现里发生了什么

先看 public 侧（`react/src/ReactHooks.js`），薄到令人发指：

```js
export function useState(initialState) {
  return resolveDispatcher().useState(initialState);
}
function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;
  if (dispatcher === null) {
    throw new Error('Invalid hook call. Hooks can only be called inside of the body of a function component.');
  }
  return dispatcher;
}
```

`ReactCurrentDispatcher.current` 就是全局那个"当前 dispatcher"插槽。渲染期间（`renderWithHooks`）由 reconciler 写入：

```js
function renderWithHooks(current, workInProgress, Component, props) {
  workInProgress.memoizedState = null;       // 清空本轮 hook 链表起点
  if (current !== null && current.memoizedState !== null) {
    ReactCurrentDispatcher.current = HooksDispatcherOnUpdate;   // 更新
  } else {
    ReactCurrentDispatcher.current = HooksDispatcherOnMount;    // 挂载
  }
  const children = Component(props);          // 组件执行，useState 命中对应实现
  ReactCurrentDispatcher.current = null;      // 渲染完置空 → 组件外调用即抛错
  return children;
}
```

于是"挂载"和"更新"两份 `useState` 实现被无缝切换——用户代码一个字都不用改。

hook 链表（`mountWorkInProgressHook` / `updateWorkInProgressHook`）负责"按顺序记住"：

```js
function mountWorkInProgressHook() {
  const hook = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
  if (workInProgressHook === null) currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  else workInProgressHook = workInProgressHook.next = hook;
  return workInProgressHook;
}
```

`updateWorkInProgressHook` 把 current 树的 hook **克隆**到 wip——但 `queue` 对象是**共享引用**：dispatch 写入的更新，下一次 render 才读得到，靠的就是这个共享队列。

## 我们动手：mini-实现

`packages/react/src/ReactHooks.ts`（public 侧）+ `packages/react-reconciler/src/ReactFiberHooks.ts`（运行时）：

| 机制 | 实现 |
| --- | --- |
| 双实现切换 | `HooksDispatcherOnMount` / `HooksDispatcherOnUpdate` 写入 `ReactSharedInternals.ReactCurrentDispatcher` |
| hook 链表 | `mountWorkInProgressHook` / `updateWorkInProgressHook` |
| 环形 pending | `enqueueUpdate`（`queue.pending` 环形，O(1) 入队）+ `processUpdateQueue`（断环 → 拼 baseQueue → FIFO 应用） |
| eager bailout | `dispatchReducerAction` 里队列为空时立即试算，`Object.is` 相同则跳过调度 |

`useState` 本质是 `useReducer(basicStateReducer, init)`：内置 reducer 就是"函数 action 调用之，否则直接返回"。

## 一个一句话就能记住的坑："hook 不能写在条件里"

因为 hook 的身份是**下标**（在链表里的位置），不是名字。`if (show) { useState() }` 会让同一组件在不同 render 里 hook 数量不同——下标全部错位，`updateWorkInProgressHook` 直接抛 `Rendered more hooks`。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 队列处理 | 按 lane 跳过 + 中断后 baseQueue 保留 | 无 lane，全量处理并清空（第 15 章补） |
| eager 优化 | dispatchSetState 里完整版 | 有 Object.is bailout（不含 reducer 复杂判定） |
| 其余 hooks | 全套 | 只 useState/useReducer（useEffect 第 9 章…） |
| dispatcher 变体 | mount/update/rerender/enableSchedule | mount/update 两份 |

## 验证

```bash
pnpm test                     # hooks.test.ts：计数器 / 批内合并 / bailout / 顺序错误 / useReducer
pnpm playground:dev           # Demo04 交互计数器：点 +1 看只改一个文本节点
```

下一篇预告：**useEffect/useLayoutEffect**——副作用链表的 `pushEffect` 与 Passive/Layout 两种优先级，以及"effect 在 paint 之后、layout 在 commit 之内"的执行时机。