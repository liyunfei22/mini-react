# 技术专栏：mini-react 源码解析

每章 = 一段可运行的源码实现 + 一篇掘金文章。本文件是系列的**唯一进度事实源**。

## 进度表

| 篇  | 章节                                                 | 状态        | 掘金链接 |
| --- | ---------------------------------------------------- | ----------- | -------- |
| 00  | 系列导读：为什么读 React 源码                        | ✅ 草稿待发 | —        |
| 01  | React 是怎么打包的：还原 scripts/rollup 式构建脚手架 | ✅ 草稿待发 | —        |
| 02  | createElement 与 JSX 运行时                          | ✅ 已完成   | —        |
| 03  | Fiber 数据结构与双缓冲                               | ✅ 已完成   | —        |
| 04  | 首屏挂载全链路：render(workLoopSync)                 | ✅ 已完成   | —        |
| 05  | 提交阶段 commitRoot：三阶段与双缓存切换              | ✅ 已完成   | —        |
| 06  | useState/useReducer：hook 链表与更新队列             | ✅ 已完成   | —        |
| 07  | 更新调度：scheduleUpdateOnFiber 先走同步             | ✅ 已完成   | —        |
| 08  | Reconciliation / Diff：key 心智模型                  | ✅ 已完成   | —        |
| 09  | useEffect/useLayoutEffect：副作用链表                | ✅ 已完成   | —        |
| 10  | useMemo/useCallback/useRef 一种套路                  | ✅ 已完成   | —        |
| 11  | Context：valueCursor 与依赖收集                      | ✅ 已完成   | —        |
| 12  | ref 与 forwardRef 的转发链                           | ✅ 已完成   | —        |
| 13  | 合成事件系统：根委托与事件→Lane                      | ✅ 已完成   | —        |
| 14  | Scheduler：MessageChannel 时间切片                   | ✅ 已完成   | —        |
| 15  | Lane 模型：优先级即 31 位掩码                        | ✅ 已完成   | —        |
| 16  | 并发升级：可中断渲染 / startTransition               | ✅ 已完成   | —        |
| 17  | 发布打磨与全链复盘                                   | ✅ 已完成   | —        |

## 目录约定

```
articles/
├── README.md          # 本文件（进度表）
├── 00-系列导读/index.md   # frontmatter + 正文；本地图片放同目录 assets/
│   └── assets/
└── ...
```

## 文章 frontmatter 规范

```yaml
---
title: React 源码解析 01：…… # 发布标题（系列前缀 + 问题 + 产出）
summary: …… # 掘金「摘要」栏
tags: [前端, React, 源码分析] # 3~5 个
cover: https://cdn.jsdelivr.net/gh/<user>/mini-react@main/articles/NN-slug/assets/cover.png
date: 2026-09-21 # YYYY-MM-DD
series: mini-react 源码解析
seriesIndex: 1 # 数字，决定上一篇/下一篇内链排序
originalSource: https://github.com/<user>/mini-react # 掘金「原文地址」
draft: true # false = 可以发布；tools 脚本据此提示
---
```

掘金**不识别 frontmatter**：粘贴正文前用 `pnpm article:juejin`（tools/to-juejin.mjs）剥离并校验。

## 每篇发布清单（发布前逐条过）

1. **dev**：本章节源码 commit 完成，playground demo 可跑。
2. **review**：`index.md` 过审——术语一致、事实核对、代码在仓库 checkout 验证可运行。
3. **article**：`pnpm article:juejin` 出纯正文（`.juejin-body.md`）；检查 heading 层级（掘金目录用它）。
4. **images**：GIF ≤ 2MB；图片统一走 jsDelivr（`cdn.jsdelivr.net/gh/<user>/mini-react@main/...`），验证 URL 200。
5. **publish**：粘贴 → 填发布弹窗（标题/摘要/封面/标签 3~5 个/声明原创/原文地址）→ 预览检查目录、代码高亮、表格、GIF。
6. **反馈**：发布后回填本表「掘金链接」；在系列上一篇文末更新"下一篇预告"。

## 写作规范速记

- **mermaid 不入正文**：掘金不渲染，图表一律导出 PNG/SVG 当图片。
- 代码单块 5~40 行、核心 60 行封顶，不整文件粘贴。
- 结构三段式：`## 官方实现里发生了什么` → `## 我们动手：mini-实现` → `## 差异对照表`。
- 对照阅读法：正文写到 React 18.2 源码路径（如 `packages/react-reconciler/src/ReactFiberBeginWork.js`），
  读者可到 `node_modules/react-reconciler`（如有）或本仓库 `packages/*` 逐行 diff。
