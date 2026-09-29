---
title: React 源码解析 17：收官——把 17 个零件装回一张地图（全链复盘）
summary: 00~16 装好的零件，这一篇把它们拼回一张地图：描述→构造→提交→调度四条主线、Fiber/Lane/Scheduler 三个支点、以及一路主动砍掉的那些能力；文末附逐章发布清单，作为整套专栏的收官索引。
tags: [前端, React, 源码分析, 复盘]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/17-retrospective/assets/cover.png
date: 2026-09-24
series: mini-react 源码解析
seriesIndex: 17
originalSource: https://github.com/liyunfei22/mini-react
draft: false
---

# 问题：走完 16 章，能不能用一张地图装下整条路

前面 16 篇是一颗颗零件：createElement、Fiber、commit、Hooks、Diff、Context、Refs、事件、Scheduler、Lane、并发。单看每一篇都清楚，合起来却容易迷路——**这一篇就干一件事：把零件拼回地图，然后老老实实列一张「我们主动放弃了什么」的清单。**

## 四条主线：一条 setState 从 element 到 DOM 的完整旅行

整套仓库的骨架只有四个词，按一次渲染的生命周期排：

| 阶段 | 关键词 | 对应章节 | 关键文件 |
| --- | --- | --- | --- |
| 描述 | element | 02 | `packages/react/src/ReactElement.ts` |
| 构造 | render / fiber | 03、04、08 | `ReactFiber.ts`、`ReactChildFiber.ts` |
| 提交 | commit | 05、09、12 | `ReactFiberCommitWork.ts` |
| 调度 | lane / scheduler | 07、14、15、16 | `ReactFiberLane.ts`、`ReactFiberWorkLoop.ts` |

**描述**解决"要画什么"，**构造**解决"怎么一步步画到一半还能停"，**提交**解决"最后一次性落到 DOM"，**调度**解决"什么时候画、画不完先画哪个"。React 18 的"可中断渲染"，本质就是给这四个词都配上了"随时能停、停完能续"的机关。

## 三个支点：Fiber · Lane · Scheduler 怎么咬合

"可中断"不是某一个天降神器，而是三个朴素机制咬出来的：

- **Fiber（03）**：把递归变成 `child/sibling/return` 链表，游标能停在任何节点，还能用 `alternate` 双缓冲「一边改、一边保底」。
- **Lane（15）**：用 31 位掩码同时装下多种优先级，位运算天然支持合并、剔除、取最高优先。
- **Scheduler（14）**：用 MessageChannel + 5ms 帧预算切开时间片，`shouldYield` 每单元问一次"该让了吗"。

三者在第 16 章拧成一股：`requestUpdateLane` 按 lane 定优先级 → `ensureRootIsScheduled` 分派到同步或 Scheduler → `workLoopConcurrent` 每单元问 `shouldYield`。而真正让 lane 起作用的最后一环，是 **`processUpdateQueue` 按 `renderLanes` 过滤更新**——没有它，高优先级的一次 sync 渲染会把低优先级的 transition 更新一并吞掉，所谓"异步"就名存实亡了（这一处是第 16 章对抗性复核时抓出来的真 bug）。

## 差异自白全集：我们主动放弃了什么

一个为了"读懂原理"砍掉能力的学习仓库，最忌讳假装自己是完整 React。下面是全集：

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 打包产物 | react-dom/client 单独出包 + NODE_ENV 选择器 shim | exports `./client` 映射主包，`development/default` 条件替代 |
| 压缩 | Closure Compiler + profiling 变体 | terser，不产 profiling（01） |
| HostConfig | 构建期 rollup fork 选宿主 | 运行期 `initializeHostConfig` 注入 |
| 事件→lane 桥接 | getCurrentUpdatePriority 全接 | 默认回落 SyncLane（离散事件仍同步） |
| useTransition 的 isPending | 过渡渲染 commit 后才清 | 同步结束后即清（简化） |
| useDeferredValue | 专用 transition + peekValue | useState + transition effect 近似 |
| 并发中断恢复 | 完整（finish / ping / 重试） | 允许中断 + 续排，无 Suspense |
| 渲染环节 | beginWork bailout、更新队列构建期 fork | 无 bailout（整树重渲染） |

> **〔更新〕第 18/19 章已补上**：上表「无 bailout（整树重渲染）」与「无 Suspense」两行已成历史——bailout（beginWork 早退 / childLanes）与 Suspense（thenable 挂起 / fallback / wake 唤醒）均已落地。Suspense 走 legacy 风格（挂起丢弃 subtree、无 Offscreen 保留），「想更进一步」清单里只剩 scheduling profiler 一块。

> 一个透明的已知局限：`updateWorkInProgressHook` 里 wip 与 current **共享 queue 对象**（第 6 章的简化）。若一次并发渲染真被 `shouldYield` 打断并丢弃，共享队列的原地改动理论上会丢 pending 更新——但 mini 没有 Suspense、demo 树都极小，`shouldYield` 永远走不满 5ms，所以这条路径实际上不可达。写在这里，是想让你知道：**不是没想到，是它真的暂时用不上。**

## 学习路径与延伸阅读

1. `pnpm playground:dev` 跑起来，看着元素树对照读。
2. 按路线图 02 → 03 → 04 → 05 → 06~10 → 11~13 → 14~16 逐章走，每章先看「官方实现里发生了什么」再 diff `packages/*`。
3. 对照阅读法：官方源码认准 [facebook/react tag v18.2.0](https://github.com/facebook/react/tree/v18.2.0)，本仓库每个文件头都标了对应官方路径。
4. 想更进一步：给 mini 补 bailout（`ReactFiberBeginWork` 的 `bailoutOnAlreadyFinishedWork`）、补 Suspense（`renderRootConcurrent` 里识别 `Suspended` 返回）、补 scheduling profiler——三者是 React 18 剩余最硬的三块。

## 逐章发布清单（打磨）

`pnpm article:juejin` 会剥出纯正文并校验 frontmatter/图片。发布前每篇再过一遍：

1. **draft**：`draft: false` 才可发布；一次翻一篇。
2. **用户名**：frontmatter 的 `cover`/`originalSource` 已填 `liyunfei22`，与 GitHub 仓库名保持一致。
3. **封面**：20 张 `cover.png`（1200×630，第 18/19 章各再补一张）走 jsDelivr，推送后记得把封面的 GitHub 仓库建好。
4. **推送**：`git remote add origin git@github.com:liyunfei22/mini-react.git && git push -u origin main`。
5. **正文**：粘贴 `articles/NN-*/**/.juejin-body.md`（已剥 frontmatter），标题/摘要/封面/标签 3~5 个/声明原创/原文地址按正文前的 frontmatter 填。
6. **回填**：发布后把掘金链接写回 `articles/README.md` 进度表「掘金链接」列。

## 验证

```bash
pnpm check    # typecheck → test(107) → build(16 产物) → playground build，全绿
```

到这里，从 `createElement` 到并发渲染的全链，代码、文章、封面、发布路径都齐了。剩下的，就是打开 `node_modules/react-dom`，跟这个仓库逐行 diff，把"我读懂了"变成"我写出来了"。