---
layout: home

hero:
  name: mini-react 源码解析
  text: 从零手写 React 18（含并发）
  tagline: Fiber · Hooks · 事件 · Diff · Context · Ref · Scheduler · Lane · 并发渲染 · Suspense —— 每章一段可运行源码 + 一篇对照官方 v18.2.0 的深度拆解
  actions:
    - theme: brand
      text: 开始阅读
      link: /chapters/00-系列导读
    - theme: alt
      text: 查看源码仓库
      link: https://github.com/liyunfei22/mini-react

features:
  - title: 逐章对照官方源码
    details: 每个文件头都标着对应的 facebook/react v18.2.0 路径，可打开 node_modules 里的真源码逐行 diff。
  - title: 可运行而非复刻
    details: 目标不是做一个能用的库，而是读懂原理。每一章对应一段能跑的 TypeScript 实现 + Vitest 单测 + playground 演示。
  - title: 诚实交代差异
    details: 每篇文末一张「差异对照表」，把主动砍掉的能力一条条写清楚，不假装自己是完整 React。
---

## 这个系列怎么读

一句话：**先看「官方实现里发生了什么」，再 diff `packages/*` 里我们自己的极简版，最后看那张差异对照表。**

- 章节路线：`02 描述 → 03~08 构造 → 05/09/12 提交 → 07/14/15/16 调度 → 18 bailout → 19 Suspense`，循序渐进。
- 代码就在本仓库 `packages/`（react / react-reconciler / react-dom / scheduler / shared），每章一个 commit。
- 想让 demo 跑起来看效果：

```bash
pnpm install
pnpm playground:dev   # 打开演示台，dev 态直连包源码
pnpm check            # typecheck → test → build → playground build，全绿
```

## 章节一览

| 篇 | 主题 | 篇 | 主题 |
| --- | --- | --- | --- |
| 00 | 系列导读 | 10 | useMemo / useCallback / useRef |
| 01 | 还原 scripts/rollup 构建脚手架 | 11 | Context valueCursor |
| 02 | createElement 与 JSX 运行时 | 12 | ref 与 forwardRef |
| 03 | Fiber 数据结构与双缓冲 | 13 | 合成事件系统 |
| 04 | 首屏挂载 render+commit | 14 | Scheduler 时间切片 |
| 05 | commit 三阶段 | 15 | Lane 模型 |
| 06 | useState / useReducer | 16 | 并发渲染（可中断 / startTransition） |
| 07 | 更新调度 | 17 | 全链复盘 |
| 08 | Diff 与 key | 18 | bailout 优化 |
| 09 | useEffect / useLayoutEffect | 19 | Suspense 挂起与唤醒 |

从 [第 00 篇 · 为什么读 React 源码](/chapters/00-系列导读) 开始，或直接跳进 [第 03 篇 · Fiber 数据结构](/chapters/03-fiber-data-structure) 看这套机从递归到可中断遍历的转折点。