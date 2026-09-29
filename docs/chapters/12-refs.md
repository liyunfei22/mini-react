---
title: React 源码解析 12：ref 与 forwardRef——attachRef 为什么在布局阶段而不是挂在 DOM 那一步
description: 一个 ref 盒子怎么在 commit 结束时被填上 DOM 节点？answer 是：mutation 阶段先 detach 旧 ref、layout 阶段再 attach 新 ref；而 forwardRef 只是把 ref 当作 render 的第二个参数透传下去。顺带讲了"每一个新 fiber tag 都要在 beginWork/completeWork/commit 三处同步接上"这个反复出现的坑。
---
`createRef()` 只返回一个 `{ current: null }`，可 commit 一结束，`ref.current` 就指向了真实 DOM。这个"填空"发生在哪？答案是 commit 的**布局阶段**，而且分两步：先 detach、再 attach。

## 官方实现里发生了什么

`Ref` 这个 flag（放在 fiber 上）标记"这个 fiber 有需要处理的 ref"。commit 的两个阶段分别处理：

1. **mutation 阶段**（`flags & Ref`）：`safelyDetachRef` 把旧 ref 清掉（函数 ref 收 `null`、对象 ref 的 `current = null`）；
2. **layout 阶段**（`flags & Ref`）：`commitAttachRef` 把新 ref 挂上——因为此时 DOM 已经改完，`stateNode` 可用：

```js
function commitAttachRef(finishedWork) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    if (typeof ref === 'function') ref(instance);
    else ref.current = instance;
  }
}
```

为什么 attach 必须在 layout 而不是 mutation？一句话：**mutation 只负责改 DOM，layout 才负责"读 DOM 之后的副作用"**——ref 要指向的节点此刻才真正就位。

而 `forwardRef` 呢？它不做任何 attach，只是给 render 多传一个参数：

```js
// forwardRef((props, ref) => <div ref={ref} />)
// beginWork ForwardRef 分支：
const render = workInProgress.type.render;
nextChildren = renderWithHooks(current, workInProgress, render, props, workInProgress.ref);
```

外层 `<MyComp ref={myRef}>` 的 ref 存进 ForwardRef fiber 的 `ref`，再作为第二个参数透传给 render，render 里 `<div ref={ref}>` 又把它落到内部 host——attach 发生在最内层的 DOM 上。

## 我们动手：mini-实现

| 文件 | 新增 |
| --- | --- |
| `ReactCreateRef.ts` / `ReactForwardRef.ts` | `createRef`（`{current:null}`）、`forwardRef`（`{$$typeof, render}`） |
| `ReactFiber.ts` | `createFiberFromTypeAndProps` 加 `ref` 参数 + 识别 ForwardRef |
| `ReactChildFiber.ts` | `markRef`（有 ref 就记到 fiber 并打 Ref flag，**只对 HostComponent**） |
| `ReactFiberCommitWork.ts` | mutation 里 `detachRef`、layout 里 `commitAttachRef`、删除时 detach |

一个关键细节：`markRef` 只给 **HostComponent** 打 `Ref` flag。因为 FunctionComponent/ForwardRef 没有 `stateNode`，attach 没意义——它们的 ref 要么透传（forwardRef），要么根本没 ref。

## 又一次"新 tag 三处接上"

给 fiber 加 `ForwardRef` 这个 tag 时，我们在 beginWork 加了分支，却**忘了 commit 的 mutation 遍历**。结果 forwardRef 组件的 placement 被 `default: return` 跳过，DOM 没挂进容器、`ref.current` 指向一个游离的节点。第 11 章 ContextProvider 踩过一模一样的坑。教训再次得到强化：

> **每加一种 fiber tag，beginWork / completeWork / commit 三处（以及 layout/passive 的 effect 遍历 + 删除清理）都要同步接上。**

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 回调 ref 每次都重触发 | 是（每 commit 都 `ref(instance)` + `ref(null)`） | 近似（markRef 每次重打标） |
| ref 移除时的 detach | 有（Ref 变化检测） | 仅卸载时 detach（移除不换 DOM 的场景未细做） |
| string ref | 支持（已弃用） | 不支持 |

## 验证

```bash
pnpm test    # refs.test.ts：ref.current 指向 DOM / 回调 ref / 卸载置 null / forwardRef 转发
```

下一篇预告：**合成事件系统**——根节点事件委托、SyntheticEvent 包装、事件优先级到 Lane 的映射，以及为什么 React 不在每个 DOM 上绑事件。
