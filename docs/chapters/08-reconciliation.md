---
title: React 源码解析 08：Diff 的 key 心智模型——lastPlacedIndex 如何判断"复用"还是"移动"
description: key 为什么能让列表复用而不是重建？拆开数组 diff：第一趟位置匹配、break 进入 keyed map 阶段、placeChild 里 oldIndex 与 lastPlacedIndex 的一次比较如何决定一个节点该留在原地、移动还是插入，以及 commit 阶段怎么用 getHostSibling 把它插到正确的位置。
---
看两份几乎一样的列表：

```jsx
// 没有 key：React 靠位置逐项比对
[<Li>a</Li>, <Li>b</Li>, <Li>c</Li>]
// 有 key：靠 key 找旧节点复用
[<Li key="a">a</Li>, <Li key="b">b</Li>, <Li key="c">c</Li>]
```

调换顺序时，**没有 key 的会被整段重建，有 key 的只移动 DOM 引用**。这就是 `key` 的意义：它把"这行的身份"从"它在数组里的下标"解耦出来。本章拆开 `reconcileChildrenArray` 看这到底怎么做到的。

## 官方实现里发生了什么

`ReactChildFiber.new.js` 的 `reconcileChildrenArray` 是**两趟**：

**第一趟（位置匹配）**：old 与 new 从头对齐，同位置、同 key、同 type 就复用：

```js
for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
  if (oldFiber.index > newIdx) { nextOldFiber = oldFiber; oldFiber = null; }
  else { nextOldFiber = oldFiber.sibling; }
  const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
  if (newFiber === null) {
    if (oldFiber === null) oldFiber = nextOldFiber;
    break;   // ← 关键：第一个失配就跳出，进入 map 阶段
  }
  if (shouldTrackSideEffects && oldFiber && newFiber.alternate === null) {
    deleteChild(returnFiber, oldFiber);   // 同位置但 key/type 变了 → 删旧
  }
  lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
  // …串 sibling…
  oldFiber = nextOldFiber;
}
```

**第二趟（key map）**：剩下的 old 按 key（无 key 按 index）丢进 `Map`，再按新顺序逐个 `updateFromMap` 捞出来复用，捞完还留在 map 里的就是"该删的"。

而"复用 / 移动 / 插入"三态判定，全在 `placeChild` 这一行比较里：

```js
function placeChild(newFiber, lastPlacedIndex, newIndex) {
  newFiber.index = newIndex;
  if (!shouldTrackSideEffects) return lastPlacedIndex;   // 挂载不打标
  const current = newFiber.alternate;
  if (current !== null) {
    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      newFiber.flags |= Placement;   // 移动
      return lastPlacedIndex;
    }
    return oldIndex;                  // 原地复用
  } else {
    newFiber.flags |= Placement;      // 插入
    return lastPlacedIndex;
  }
}
```

`lastPlacedIndex` 记录"已确认不用动的节点里，最大的旧下标"。一个旧节点只要旧下标**小于**它，就说明它被 && 到前面去了 → 需要移动 → 打 `Placement`。commit 阶段再用 `getHostSibling` 找到"已提交的邻居"，`insertBefore` 把它插到正确位置。

## 一个我们踩过、值得写下来的坑：`break` 而不是 `continue`

第一趟的 `newFiber === null` 必须是 `break`（整个退出位置匹配、交给 map），不是 `continue`（跳过 try 下一个）。我们初版写成了 `continue`——于是 `[a,b,c] → [c,a,b]` 会变成 `[a,b]` 且 c 被误删。原因：key 一旦在某个位置失配，后面的"位置对齐"全部不可信，只能整段退到 map 阶段按 key 重新配。这一行之差就是"正确 diff"和"列表凭空丢元素"的分水岭。

## 我们动手：mini-实现

`packages/react-reconciler/src/ReactChildFiber.ts` 补齐本章：

| 函数 | 作用 |
| --- | --- |
| `updateSlot` / `updateElement` / `updateTextNode` | 同位置复用（key/type 对得上才复用） |
| `mapRemainingChildren` | 剩余 old → key/index 映射 |
| `updateFromMap` | 按 key 捞取复用 |
| `reconcileChildrenArray` | 两趟：位置匹配 → 失配 break → key map |
| `getHostSibling`（commit） | 移动时算 insertBefore 的目标 |

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| Fragment / lazy / hot-reload 分支 | 有 | 无（Fragment 见 createElement 章） |
| 两端 diff / 逆向优化 | 注释提到尚未实现 | 同（单端 forward） |
| key 校验 | DEV warnOnInvalidKey | 无 |
| 移动落位 | insertOrAppendPlacementNode + getHostSibling | 同（getHostSibling 简化版） |

## 验证

```bash
pnpm test                     # diff.test.ts：重排复用 / insertBefore / 追加 / 删除 / 无 key 复用 / key 变化重建
pnpm playground:dev           # Demo05：+追加 / -删除 / 反转三者对比
```

下一篇预告：**useEffect/useLayoutEffect**——side-effect 链表的 pushEffect、Passive/Layout 两种提交时机，以及 cleanup 为何在每次依赖变化时先跑。
