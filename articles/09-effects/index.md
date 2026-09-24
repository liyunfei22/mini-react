---
title: React 源码解析 09：useEffect/useLayoutEffect——副作用链表与两种提交时机
summary: useEffect 为什么在 paint 之后、useLayoutEffect 为什么在 commit 里同步跑？拆开 effect 链表：pushEffect 的环形 lastEffect、HasEffect 位如何编码"deps 变化"、cleanup 为何先于下一次 create 执行，以及卸载时副作用如何清理。
tags: [前端, React, 源码分析, Hooks]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/09-effects/assets/cover.png
date: 2026-09-23
series: mini-react 源码解析
seriesIndex: 9
originalSource: https://github.com/liyunfei22/mini-react
draft: true
---

# 问题：useEffect 和 useLayoutEffect 到底差在哪

两个 hook 都是"在组件渲染后跑一段副作用"，唯一区别是**执行时机**：

- `useLayoutEffect`：**同步**，在 commit 的 layout 阶段、DOM 改完之后立刻跑；
- `useEffect`：**异步**，在浏览器 paint 之后才跑（React 里是调度到下一轮）。

一句话记忆：**layout 在 commit 内，effect 在 paint 后**。为什么 React 要搞两种？因为如果你要在"改完 DOM 但还没画出来"的时刻同步读取布局（比如测量尺寸），必须用 layout；而大多数"发请求 / 打日志 / 订阅"这类不阻塞渲染的副作用，应该用 effect 让出主线程。

## 官方实现里发生了什么

effect 的核心是一个**环形链表**，挂在函数组件 fiber 的 `updateQueue.lastEffect` 上。每个 effect 节点：

```js
{
  tag,      // HasEffect(本轮要不要触发) | Layout/Passive(属于哪个阶段)
  create,   // 副作用本体
  destroy,  // cleanup
  deps,     // 依赖数组
  next,     // 环形
}
```

`pushEffect`（ReactFiberHooks.new.js）把新 effect 追加到环尾；`mountEffectImpl`/`updateEffectImpl` 负责打 tag：

```js
function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy = undefined;
  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState;
    destroy = prevEffect.destroy;                 // 把旧 cleanup 搬过来
    if (nextDeps !== null) {
      if (areHookInputsEqual(nextDeps, prevEffect.deps)) {
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps); // 无 HasEffect → 不重跑
        return;
      }
    }
  }
  currentlyRenderingFiber.flags |= fiberFlags;   // Passive 或 Update
  hook.memoizedState = pushEffect(HookHasEffect | hookFlags, create, destroy, nextDeps);
}
```

关键就在那个 **`HookHasEffect` 位**：deps 变了才 `| HasEffect`，commit 阶段据此决定"这个 effect 本轮要不要触发"。

提交时机分三处（ReactFiberCommitWork）：

1. **mutation 阶段**：fiber 带 `Update` 时，先 `commitHookEffectListUnmount(HookLayout | HookHasEffect, ...)` 跑 useLayoutEffect 的 cleanup；
2. **layout 阶段**（交换 current 之后）：`commitHookEffectListMount(HookLayout | HookHasEffect, ...)` 同步跑 create；
3. **passive**（异步 flushPassiveEffects）：先 unmount 旧 passive 的 cleanup、再 mount 新 create。

`commitHookEffectListMount` 执行时：`effect.destroy = create()`——**把这次的 cleanup 记到 destroy 上**，下次 change/卸载时再跑。这就是"cleanup 先于下一次 create"的机制来源。

## 我们动手：mini-实现

`packages/react-reconciler/src/`：

| 文件 | 新增 |
| --- | --- |
| `ReactHookEffectTags.ts` | HasEffect / Insertion / Layout / Passive 四个位 |
| `ReactFiberHooks.ts` | `pushEffect` / `areHookInputsEqual` / `mountEffectImpl` / `updateEffectImpl` + 四个 hook |
| `ReactFiberCommitWork.ts` | layout 双阶段 + passive 异步 flush + 删除时清理 |

passive 的"异步"在本章用 `scheduleMicrotask(flushPassiveEffects)` 实现（第 14 章接 Scheduler 后换成按优先级调度，本质不变）。

## 一个反直觉的小实验：闭包快照 vs 模块变量

写 effect 时，`create`/`cleanup` 闭包捕获的是**渲染那一轮的值**。测试里若把依赖放在模块级可变变量里（`let depsVersion = 1`），cleanup 运行时读到的会是**调用时的最新值**（变成 `cleanup:2` 而非 `cleanup:1`）——这不是 bug，恰恰是"依赖要闭包渲染时的 props 快照"这一原则的体现，也是"过期闭包"陷阱的另一面。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| passive 调度 | Scheduler（Normal 优先级） | queueMicrotask（第 14 章换） |
| Insertion effect | useInsertionEffect | 未实现 |
| 卸载清理 | beforeMutation + deletion 分离 | deletion 内一次性跑 layout+passive cleanup |
| StrictMode 双跑 | dev 双执行 | 无 |

## 验证

```bash
pnpm test                     # effects.test.ts：layout 同步/passive 异步、cleanup 先于 create、deps 变化、卸载清理
pnpm playground:dev           # Demo06 时钟：effect 挂 interval、cleanup 清 interval
```

下一篇预告：**剩余 hooks 的一种套路**——useMemo/useCallback/useRef 三兄弟，以及它们都只是"memorize 到 hook.memoizedState"这么一个共同实现。