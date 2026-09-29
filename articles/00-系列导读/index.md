---
title: React 源码解析 00：为什么读 React 源码，以及这套专栏要带你做什么
summary: 一套专栏的总说明：为什么手写 React、学习路径怎么排、仓库如何组织、怎么用「对照阅读法」把官方源码与自研实现逐行互相对着看。
tags: [前端, React, 源码分析]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/00-系列导读/assets/cover.png
date: 2026-09-21
series: mini-react 源码解析
seriesIndex: 0
originalSource: https://github.com/liyunfei22/mini-react
draft: false
---

# 为什么读 React 源码

打开 `node_modules/react` 你会看到一个个不认识的文件名：`ReactFiberWorkLoop`、`ReactFiberLane`、`SchedulerMinHeap`……React 的源码难读，不是因为算法多神秘，而是因为**它是为"正确性"而生的工业级实现**：为了可中断、为了可恢复、为了 16ms 一帧不卡，它把简单的事做成了复杂的机器。

但这台机器值得拆开看。理由有三：

1. **它是前端最成功的"状态→视图"引擎**。理解它，等于理解"虚拟 DOM 为什么存在、又要被 Fiber 取代"这一整个演进逻辑。
2. **它的架构决策都是收费的**。双缓冲、优先级调度、hooks 的链表实现——每一条都能直接迁移到你自己的框架/工具里。
3. **面试的深水区**。`setState 之后发生了什么`、`为什么 hooks 不能写在条件里`、`并发渲染怎么做到不丢数据`——这些问题只有一个可靠的答案来源：源码本身。

## 这套专栏怎么读

本系列**从 0 到 1 手写一个"mini-React 18"**，共 18 篇（00~17），覆盖 React 18 的「核心 + 并发」：

- **核心**：Fiber 数据结构、首屏挂载、提交阶段、hooks、diff、context、refs、合成事件；
- **并发**：Scheduler 时间切片、Lane 优先级、可中断渲染、startTransition。

每一篇 = 一段**可运行的代码** + 一篇**文章**。文章固定节奏：

```
## 官方实现里发生了什么     ← 贴官方源码核心片段（给出 v18.2.0 的文件路径）
## 我们动手：mini-实现       ← 与官方同构的我们自己代码
## 差异对照表               ← 我们砍了什么、保留了什么、为什么
## 验证                     ← 怎么跑起来看效果
```

## 配套仓库

全部代码在开源仓库 `mini-react`（monorepo，TypeScript）：

| 目录 | 对应官方 | 职责 |
| --- | --- | --- |
| `packages/react` | `packages/react` | 用户侧 API：createElement、JSX 运行时、hooks 入口 |
| `packages/react-reconciler` | `packages/react-reconciler` | 与 host 无关的 Fiber / 渲染 / 提交 / hooks |
| `packages/react-dom` | `packages/react-dom` | DOM 渲染器 + 事件系统 |
| `packages/scheduler` | `packages/scheduler` | 时间切片调度器 |
| `packages/shared` | `packages/shared` | 共享工具与跨包总线 |
| `scripts/` | `scripts/rollup/` | 打包脚手架（dev/prod × esm/cjs/umd） |
| `apps/playground` | — | 每章演示台 |

> 快速上手：`pnpm install && pnpm check && pnpm playground:dev`。

## 对照阅读法（本系列最重要的技能）

读 React 源码最怕"淹没在细节里"。推荐姿势：

1. **先跑，再读**：每个概念先用 playground/demo 亲手触发一次，看现象。
2. **穿着拖鞋走主路**：跟着 `setState` 的调用链走一遍 main path（本系列文章就是这条路），
   主干外的东西（portal、Suspense、hydration）放后面。
3. **逐行 diff**：把本仓库 `packages/*` 与官方对应文件并排打开，看我们**替你砍掉的每一行**，
   那就是你需要额外补的边界。

## 系列目录

| 篇 | 主题 |
| --- | --- |
| 01 | React 是怎么打包的：还原 scripts/rollup 式构建脚手架 |
| 02 | createElement 与 JSX 运行时 |
| 03 | Fiber 数据结构与双缓冲 |
| 04 | 首屏挂载全链路 |
| 05 | 提交阶段 commitRoot |
| 06~10 | Hooks 全家桶 |
| 11~13 | Context / refs / 合成事件 |
| 14~16 | Scheduler / Lane / 并发升级 |
| 17 | 发布打磨与全链复盘 |

下一篇预告：**React 是怎么打包的**——同一份源码，为什么能产出 dev/prod 两个截然不同的产物。