---
title: React 源码解析 11：Context 的 valueCursor——值如何沿 Fiber 树入栈出栈
summary: Provider 的值怎么让子树里的组件读到、又如何精确恢复？拆开 valueCursor 全局栈、pushProvider/popProvider 的入栈出栈、readContext 如何把一次消费记进 fiber.dependencies，以及"间隔的 Provider 不重渲染"为什么靠的是一条依赖链表。
tags: [前端, React, 源码分析, Context]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/11-context/assets/cover.png
date: 2026-09-23
series: mini-react 源码解析
seriesIndex: 11
originalSource: https://github.com/liyunfei22/mini-react
draft: false
---

# 问题：`useContext` 怎么知道"现在是哪个 Provider 在管我"

`useContext(Theme)` 一句话就能读到主题，可它内部没有任何绑定逻辑——因为**值存在 context 对象上，而 context 对象是唯一的**：

```js
const Theme = createContext('light');   // 一个独一无二的对象 + 一个 _currentValue 槽位
```

Provider 渲染时把新值写进 `Theme._currentValue`，子树里任何 `useContext(Theme)` 读到的都是这个槽位。就这么简单。剩下唯一要解决的问题是：**Provider 退出后，怎么把值恢复回去**（尤其嵌套 Provider 时内层要盖外层）。

## 官方实现里发生了什么

恢复靠的是一个**全局游标 + 栈**（ReactFiberStack）：

```js
function push(cursor, value, fiber) {
  index++;
  valueStack[index] = cursor.current;   // 把旧值压栈
  cursor.current = value;               // 写新值
}
function pop(cursor, fiber) {
  cursor.current = valueStack[index];   // 恢复旧值
  valueStack[index] = null;
  index--;
}
```

`pushProvider` / `popProvider`（ReactFiberNewContext）就是包装这一对操作：

```js
export function pushProvider(providerFiber, context, nextValue) {
  push(valueCursor, context._currentValue, providerFiber);  // 旧值进栈
  context._currentValue = nextValue;                        // 新值生效
}
export function popProvider(context, providerFiber) {
  const currentValue = valueCursor.current;                 // 进 Provider 前的旧值
  pop(valueCursor, providerFiber);
  context._currentValue = currentValue;                     // 恢复
}
```

beginWork 走 `ContextProvider` 分支时 `pushProvider`，completeWork 里 `popProvider`——因为渲染是深度优先，push/pop 严格配对，一个全局栈就够，这就是"值沿 Fiber 树入栈出栈"。

而 `readContext`（useContext 的实现）除了读值，还做了一件关键的事——**记录依赖**：

```js
export function readContext(context) {
  const value = context._currentValue;
  // 把这次消费挂进 fiber.dependencies（一条 ContextItem 链表）
  const contextItem = { context, memoizedValue: value, next: null };
  if (lastContextDependency === null) {
    currentlyRenderingFiber.dependencies = { lanes: NoLanes, firstContext: contextItem };
  } else {
    lastContextDependency = lastContextDependency.next = contextItem;
  }
  return value;
}
```

这条 `dependencies` 链表，正是"Provider 变了只重渲染真正订阅了它的组件"的凭据——等 bailout 落地（第 14~16 章），变更传播就能顺着这条链表只标记订阅者，跳过中间那些不消费 context 的组件。

## 我们动手：mini-实现

`packages/react/src/ReactContext.ts` + `packages/react-reconciler/src/ReactFiberNewContext.ts`：

| 文件 | 内容 |
| --- | --- |
| `ReactContext.ts` | `createContext`（context 对象 + Provider 包装 + Consumer 自引用） |
| `ReactFiberNewContext.ts` | `pushProvider`/`popProvider`/`readContext`/`prepareToReadContext`——栈用 **providerStack 帧栈**（每帧记 `{context, 旧值}`），而非官方 valueCursor |
| beginWork/completeWork | `ContextProvider` 分支（push / pop） |

mini 用 providerStack 而不用官方 valueCursor 的原因很实际：**渲染抛错时更好回收**。官方靠 error boundary 去 unwind 栈，mini 没有 error boundary，于是在 `performSyncWorkOnRoot` 的 finally 里 `resetContextStack()` 一次性弹出所有帧、把 context 恢复成旧值——否则 Provider 的 completeWork/pop 不执行，`_currentValue` 会残留污染后续渲染（我们复核时用 `<Provider>内抛错 → 再渲染裸组件` 实测复现了「读到残留的 dark 而非默认 light」）。

## 一个我们踩过、值得记下的坑：Provider 也要在 commit 里"通行"

`ContextProvider` fiber 是新增的 tag。我们第一版只在 beginWork/completeWork 里加了它，**漏了 commit 的 mutation 遍历**——`commitMutationEffectsOnFiber` 的 switch 没有 `ContextProvider` 分支，落进 `default: return`，整棵 Provider 子树的增删改（包括文本更新）被整个跳过。于是「setState 改主题 → 组件读到了新值「dark」→ 但 DOM 还是旧的「light」」这种诡异现象就出现了。教训：**每加一种 fiber tag，beginWork / completeWork / commit 三处都要同步接上**。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 变更传播 | propagateContextChange（只重渲染订阅者） | 无（无 bailout，整树重渲染，第 14~16 章接） |
| 栈实现 | valueCursor + 全局 valueStack | providerStack 帧栈（便于抛错回收） |
| 双渲染器值槽位 | `_currentValue` + `_currentValue2` | 仅 `_currentValue` |
| render-prop Consumer | 有 | 无（只 Provider + useContext，已注明） |

## 验证

```bash
pnpm test                     # context.test.ts：默认值 / Provider 覆盖 / 嵌套遮蔽 / setState 更新消费
pnpm playground:dev           # Demo07 主题切换
```

下一篇预告：**refs 与 forwardRef**——attachRef 的提交时机、forwardRef 如何把 ref 转发给子组件的 DOM，以及"ref 是 commit 布局阶段的副作用"这一事实。