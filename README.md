# mini-react — 从零手写 React 18（含并发）

> 一个用 TypeScript 从 0 到 1 手写 React 18 源码的学习仓库。目标不是"复刻一个能用的库"，而是**读懂 React 原理与源码设计**——
> 每一章 = 一段可运行的源码实现 + 一篇掘金技术文章 + 一个 playground demo。

## 仓库交付

| 交付物 | 说明 |
|---|---|
| 🧩 **mini-react** | TypeScript 实现的 React 18「核心 + 并发」子集：Fiber、Hooks、事件系统、Diff、Context、Refs、Scheduler、Lane、可中断渲染、useTransition |
| 📚 **技术专栏** | `articles/` 每章一篇文章，系列发布到掘金（`tools/` 提供发布辅助工具） |
| 🏗️ **打包脚手架** | `scripts/` 镜像官方 React 仓库 `scripts/rollup` 的声明式打包矩阵（dev/prod × esm/cjs/umd） |

> 本 README 将在章节推进过程中持续更新。完整路线图见下表与 `articles/README.md`。

## 快速开始

```bash
pnpm install
pnpm check        # typecheck + test + build + playground build（exports 冒烟）
pnpm playground:dev   # 打开 playground demo
```

## 章节路线图

| 篇 | 主题 | 状态 |
|---|---|---|
| 00 | 系列导读 | 🚧 |
| 01 | React 的"项目怎么打包"：还原 scripts/rollup 式打包脚手架 | 🚧 |
| 02 | createElement 与 JSX 运行时 | 🚧 |
| 03-17 | Fiber / 首屏挂载 / commit / hooks / 调度 / diff / context / 事件 / scheduler / lane / 并发 | 🕐 待推进 |

## 术语约定

- 包名统一 `@mini-react/<pkg>`，避免与真实 react 冲突。
- 源码注释 / README / 文章用中文，代码标识符用英文。