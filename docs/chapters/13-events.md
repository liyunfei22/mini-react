---
title: React 源码解析 13：合成事件系统——为什么 React 不在每个 DOM 上绑事件
description: 一个列表一万个 li，React 也只在根容器绑一次事件。拆开看：根委托的 attachRootListeners、沿 target→root 路径收集 onXxx 的捕获/冒泡派发、SyntheticEvent 的 stopPropagation 标记，以及事件类型到优先级（discrete/continuous/default）的映射如何为调度铺路。
---
没有。React 的**事件委托**是：不管你的组件树有多大，同一种事件类型只在**根容器**绑一次监听。事件触发时，从 `event.target` 沿 DOM 树往根走，沿路收集该层 fiber 上的 `onXxx`，再按捕获→冒泡顺序派发。

收益有三：监听器数量 O(1) 而不是 O(n)；天然支持"事件冒泡"和你写的 `onClick` 语义；而且事件进来时 React 能统一决定"这件事的优先级"（点一下 vs 滚动一下）。

## 官方实现里发生了什么

官方的事件入口在 `react-dom/src/events`：

1. **`DOMPluginEventSystem.js`**：`listenToAllSupportedEvents(rootContainerElement)` 给根容器（React 18 是容器根，更早是 document）按事件类型挂监听器（捕获 + 冒泡两次）。
2. **`SimpleEventPlugin.js`**：事件触发时 `extractEvents` 收集发生在路径上的 handler。
3. **`SyntheticEvent.js`**：包一层原生 Event，统一 `target`/`currentTarget`，并给 `stopPropagation` 立一个**标记位**。

派发的骨架：

```js
// 捕获阶段（从根往下）
for (node = 根; node 到 target; node = node.child) {
  if (handler = props[onXxxCapture]) handler(syntheticEvent);
  if (syntheticEvent.isPropagationStopped) break;
}
// 冒泡阶段（从 target 往根）
for (node = target; node 到 根; node = node.parentNode) {
  if (handler = props[onXxx]) handler(syntheticEvent);
  if (syntheticEvent.isPropagationStopped) break;
}
```

而"事件优先级"是另一条暗线：`click` 是 **Discrete**（离散，最高）、`scroll`/`mousemove` 是 **Continuous**、`load`/`error` 是 **Default**。这个优先级在事件触发时记下来，将来 `requestUpdateLane` 据此决定这次 setState 走哪条 lane（第 15 章）。

## 我们动手：mini-实现

`packages/react-dom/src/events/`：

| 文件 | 内容 |
| --- | --- |
| `SyntheticEvent.ts` | `createSyntheticEvent`（包装 + stopPropagation 标记） |
| `DOMEventSystem.ts` | `attachRootListeners`（根委托）、`dispatchEvent`（捕获/冒泡收集）、`getEventPriority` / `getCurrentEventPriority` |

`ReactDOMHostConfig` 相应改了两处：不再 `node.addEventListener`（改成 `trackNodeProps` 把 props 登记到 WeakMap 供派发查）；`diffProperties` 也把 onXxx 纳入 diff（否则 handler 换了却不会重新登记）。

## 一个看不见的协作：nodeToProps 的 WeakMap

委托派发要找到"事件路径上每个 DOM 节点的 onXxx"，就需要一条 **DOM 节点 → 当前 props** 的映射。我们用一个模块级 WeakMap 存它：createInstance/commitUpdate 时登记。因为 key 是 DOM 节点（对象），WeakMap 会在节点被移除后自动回收，不会泄漏。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 监听挂载点 | 容器根 | 容器根（相同） |
| path 收集 | 沿 Fiber 树（internalInstanceKey） | 沿 DOM 树（nodeToProps WeakMap） |
| 事件插件体系 | SimpleEvent/Change/Select/EnterLeave 多插件 | 仅 SimpleEvent 子集 |
| enter/leave 委托 | 有专门插件 | 不支持 |

## 验证

```bash
pnpm test    # events.test.ts：根委托 / 冒泡顺序 / stopPropagation / 捕获 / 事件优先级
```

下一篇预告：**Scheduler**——进入"并发"的第一站：MessageChannel 驱动的工作循环、任务最小堆、5ms 帧预算的 shouldYield，以及 React 怎么把一段长渲染"切成片"。
