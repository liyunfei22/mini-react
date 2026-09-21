---
title: React 源码解析 02：createElement 与 JSX 运行时——虚拟 DOM 的诞生
summary: createElement 到底做了哪三件事、ReactElement 为什么用 Symbol.for 标识、key/ref 如何从 config 剥离、JSX 自动运行时（jsx/jsxs/jsxDEV）与经典 createElement 的双轨关系。附手写 mini-render 让元素树真实渲染。
tags: [前端, React, 源码分析]
cover: https://cdn.jsdelivr.net/gh/<你的GitHub用户名>/mini-react@main/articles/02-createElement与JSX运行时/assets/cover.png
date: 2026-09-21
series: mini-react 源码解析
seriesIndex: 2
originalSource: https://github.com/<你的GitHub用户名>/mini-react
draft: true
---

# 占位：正文待成稿

本章计划结构（素材已在 `packages/react/src/` 就位，测试见 `packages/react/src/__tests__/`）：

## 问题
- `key` 用错了为什么会出现输入框串位？
- `Symbol.for('react.element')` 为什么能跨库识别 element？

## 官方实现里发生了什么
- `ReactElement.js`：element 工厂 + RESERVED_PROPS + children 归一化
- `jsx/ReactJSXElement.js`：jsx / jsxs / jsxDEV（key 由第三个参数传入）

## 我们动手：mini-实现
- `packages/react/src/ReactElement.ts` / `ReactJSXElement.ts` / `jsx-runtime.ts`
- 经典 createElement 与自动运行时双轨，共用同一个工厂
- playground `Demo01`：用第 1 章的 mini-render 把元素树渲染成真实 DOM

## 差异对照表
- 我们砍掉了 `ReactElementValidator.js` 的绝大部分校验，只保留 type 校验

## 验证
- `pnpm test` 的 createElement / jsx-runtime 两个测试文件（23 个断言）
- `pnpm playground:dev` 看 Demo01 的元素树渲染