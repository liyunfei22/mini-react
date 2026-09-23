---
title: React 源码解析 10：useMemo/useCallback/useRef——三个 hook，一种套路
summary: 三个 hook 的实现短到令人发指，却共用同一个心智模型：把东西"记忆"到 hook.memoizedState，deps 没变就直接返回旧值。拆开看它们各自"记忆"的是什么——一个值、一个函数、还是一个 {current} 对象。
tags: [前端, React, 源码分析, Hooks]
cover: https://cdn.jsdelivr.net/gh/<你的GitHub用户名>/mini-react@main/articles/10-memo-callback-ref/assets/cover.png
date: 2026-09-23
series: mini-react 源码解析
seriesIndex: 10
originalSource: https://github.com/<你的GitHub用户名>/mini-react
draft: true
---

# 问题：这三个 hook 为什么实现起来都一样短

`useMemo`、`useCallback`、`useRef` 源码加起来不过四十行。它们的共同点是一句话：

> 把东西存到 `hook.memoizedState`，deps 没变就返回旧的东西。

区别只在于"东西"是什么——`useMemo` 记一个**值**，`useCallback` 记一个**函数**，`useRef` 记一个**`{current}` 对象**。

## 官方实现里发生了什么

`ReactFiberHooks.new.js` 里这三段，几乎可以直接背下来：

```js
function mountMemo(nextCreate, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();                 // 算一次，记到 memoizedState
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateMemo(nextCreate, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;           // [值, 旧deps]
  if (nextDeps !== null && areHookInputsEqual(nextDeps, prevState[1])) {
    return prevState[0];                          // deps 没变 → 直接用旧值
  }
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function mountCallback(callback, deps) {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = [callback, deps === undefined ? null : deps];
  return callback;
}
// updateCallback 与 updateMemo 几乎一模一样，只是存的/返回的是 callback

function mountRef(initialValue) {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}
// updateRef 只返回 hook.memoizedState —— 对象本身永远那一个
```

三个 hook 都在 `updateXxx` 里用同一把尺子 `areHookInputsEqual`（第 9 章那套 `Object.is` 逐个比）判断"要不要重新生成"。`useCallback(fn)` 其实就是 `useMemo(() => fn, deps)`。

## 三个 hook 各自解决什么

| hook | 记的东西 | 解决什么 | 关键语义 |
| --- | --- | --- | --- |
| `useMemo` | 值 | 昂贵计算别每次都重算 | deps 变才重算 |
| `useCallback` | 函数 | 传给子组件的函数引用别每次都变（配合 memo/bailout 用） | deps 变才换新引用 |
| `useRef` | `{current}` | 需要"跨渲染稳定的可变盒子"（拿 DOM、存 id） | 永远同一个对象 |

`useRef` 和 state 的区别：改 `ref.current` **不触发渲染**——它只是个普通的、挂在 hook 上的可变对象。

## 我们动手：mini-实现

`packages/react-reconciler/src/ReactFiberHooks.ts` 新增六个函数（mount/update × 3），接入 mount/update dispatcher。全部照搬官方结构。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| useMemo/useCallback/useRef | 有 | 有（逐字同构） |
| ref 的 dev 访问告警 | 有 | 无 |

## 验证

```bash
pnpm test    # memo.test.ts：useMemo 重算条件 / useCallback 引用稳定 / useRef 对象稳定
```

（这三个 hook 目前没有独立 playground demo——它们的行为已由测试覆盖；交互演示要等第 11 章 Context 配合 memo 才更有看点。）

下一篇预告：**useContext 与 Context 的 valueCursor**——Provider 值如何沿 Fiber 树"入栈/出栈"，readContext 如何把一次消费记录进 fiber 的 dependencies，从而让"间隔的 Provider 不重渲染"成为可能。