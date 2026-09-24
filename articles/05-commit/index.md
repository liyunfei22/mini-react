---
title: React 源码解析 05：commit 三阶段——为什么要在 Mutation 之后、Layout 之前换树
summary: 从"只能挂载一次"到"能更新/删除"：render 描述了改动，commit 才把它落到 DOM；BeforeMutation/Mutation/Layout 三段各自的职责、root.current 的交换时机这一行代码为什么放那里，以及 diff 复用与删除是怎么用 flags 和 deletions 列表表达的。
tags: [前端, React, 源码分析, DOM]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/05-commit/assets/cover.png
date: 2026-09-22
series: mini-react 源码解析
seriesIndex: 5
originalSource: https://github.com/liyunfei22/mini-react
draft: true
---

# 问题：render 是怎么从"重画"变成"只改必要 DOM"

第 4 章我们只会**挂载**：每次 `render()` 都产生一棵全新的 fiber 树、一口气插进容器。但真正的 React 绝不会二次 render 时把你写的小组件整棵重挂——它复用了节点，只改变了的那几个属性。

这一章补上两块拼图：

1. **diff 复用与删除**：同 `type` + `key` 的节点复用（`useFiber`），不同的删除（`deleteChild` 记进 `deletions`）。
2. **commit 三阶段**：真正"动 DOM"这件事，被规范成 BeforeMutation → Mutation → Layout 三段，中间夹着最关键的一行。

## 官方实现里发生了什么

`ReactFiberCommitWork.old.js` 的 `commitRootImpl` 骨架（浓缩）：

```js
function commitRootImpl(root, ...) {
  const finishedWork = root.finishedWork;
  root.finishedWork = null;

  commitBeforeMutationEffects(root, finishedWork);   // ① getSnapshotBeforeUpdate、卸载 passive
  commitMutationEffects(root, finishedWork);          // ② DOM 增删改（还基于旧 current）
  root.current = finishedWork;                        // ③ 换树！发生在 mutation 之后
  commitLayoutEffects(finishedWork, root);            // ④ refs / layout effects（读新树）
}
```

判断一个副作用该放哪段，就一句话：**它需要看旧树还是新树？**

- `getSnapshotBeforeUpdate` 要读"改动前"的 DOM → 放 ①；
- `componentDidMount`/layout effects 要读"改动后"的 DOM —— 尤其 ref 指向的节点刚被插入/更新 → 放 ④；
- 所以 ③ 的交换，既不能早（① 还在看旧树），也不能晚（④ 已经要新树）。

更新/删除的实现也不在 commit，而在 render 阶段的 **ChildReconciler**：

```js
function reconcileSingleElement(returnFiber, currentFirstChild, element, lanes) {
  const key = element.key;
  let child = currentFirstChild;
  while (child !== null) {
    if (child.key === key) {
      if (child.elementType === element.type) {
        // 复用：删掉多余兄弟，用旧 fiber 造 wip
        deleteRemainingChildren(returnFiber, child.sibling);
        const existing = useFiber(child, element.props);
        existing.return = returnFiber;
        return existing;
      }
      deleteRemainingChildren(returnFiber, child);   // 同 key 不同 type：全废
      break;
    }
    deleteChild(returnFiber, child);                  // key 不同：废掉这个旧节点
    child = child.sibling;
  }
  return createFiberFromElement(element, returnFiber.mode); // 全新
}
```

`deleteChild` 把旧 fiber 压进父 fiber 的 `deletions` 列表并置 `ChildDeletion`；`useFiber` 内部就是 `createWorkInProgress`（第 3 章那台双缓冲机器，在这里被用来"复用"旧节点）。

## 我们动手：mini-实现

`packages/react-reconciler/src/` 的改动落在四个文件：

| 文件 | 新增 |
| --- | --- |
| `ReactChildFiber.ts` | `useFiber` / `deleteChild` / `deleteRemainingChildren`；单元素+文本的复用/删除 |
| `ReactFiberCompleteWork.ts` | 更新分支：HostComponent 走 `prepareUpdate` 差分打 `Update`；HostText 内容变了打 `Update` |
| `ReactFiberWorkLoop.ts` | `completeUnitOfWork` 里的 `subtreeFlags` 上冒（commit 剪枝用） |
| `ReactFiberCommitWork.ts` | 三阶段骨架 + `commitDeletionEffects` + `commitUpdate`/`commitTextUpdate` |
| `HostConfig.ts` / react-dom | 新增 `prepareUpdate`（props diff）+ 新签名 `commitUpdate` |

## 一个写一遍就记住的坑：删除别递归删 host 子树

`commitDeletionEffects` 对 host 节点删除时，**删它一个就够**——它的 DOM 子树随 `removeChild` 一起消失，绝不能再去递归删子节点。我们第一版就踩了：div 删完又去 `removeChild` 它里面的 text，导致 `ops` 里多出一个多余的 `removeChild`。官方的语义是：只有"组件/wrapper 层"（自身无 DOM）的删除才需要递归，去找到并移除它那些 host 子孙。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| beforeMutation | getSnapshotBeforeUpdate + passive 卸载 | 空骨架（第 9 章补） |
| layout | attachRef + layout effects | 空骨架（第 9/12 章补） |
| update 差分 | diffProperties（svg/事件等全量） | 属性 + className/style，事件 defer 到第 13 章 |
| 数组 diff | key 双循环 + 移动复用 | 第 8 章补（第 5 章只做单元素/文本） |
| 卸载 | 递归组件清理/ref | 递归 host 子孙删除 |

## 验证

```bash
pnpm test                     # commit.test.ts：类型变化顺序 / 复用 / render(null) / 文本更新
pnpm playground:dev           # 右上角"第 N 帧"每秒 re-render，几秒后自动 render(null)
```

下一篇预告：**useState 与 hooks 运行时**——你会看到 `useState` 为什么只是个"读当前 dispatcher 的函数"，以及 hook 链表如何记住每次 render 的顺序。