---
title: React 源码解析 01：React 是怎么打包的——还原 scripts/rollup 式构建脚手架
description: 官方 React 仓库并没有"每个包一个配置文件"，而是一张声明式打包矩阵 × 三重循环。本篇复刻这套构建体系：__DEV__ 构建期替换、dev/prod 双产物、esm/cjs/umd 三格式，以及 React 怎么保证跨 bundle 单例。
---
打开 `node_modules/react`，你会看到：

```
react/
├── index.js
├── cjs/
│   ├── react.development.js
│   └── react.production.min.js
├── umd/
│   ├── react.development.js
│   └── react.production.min.js
```

其中 `index.js` 是个 NODE_ENV 选择器：

```js
if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/react.production.min.js');
} else {
  module.exports = require('./cjs/react.development.js');
}
```

于是问题来了：**源码里满屏的 `if (__DEV__)` 分支，是怎么在 production 里"消失"的？**
React 的答案是——构建期替换。本仓库的 `scripts/` 就是这套机制的迷你复刻。

## 官方实现里发生了什么

官方 `scripts/rollup/` 有三个关键文件：

| 文件 | 职责 |
| --- | --- |
| `bundles.js` | **声明式打包矩阵**：一张数组，描述每个 bundle 的入口、格式、环境、external |
| `build.js` | 双重 for 遍历矩阵 × bundleType，逐个调 `createBundle` |
| `forks.js` + `use-forks-plugin` | `resolveId` 重写表：构建期把某个 import 路径换成另一个源码文件 |

关键 trick 在 `build.js` 的 `getPlugins` 里：

```js
// packages/react-reconciler 源码里写 if (__DEV__)
replace({
  __DEV__: isProduction ? 'false' : 'true',  // ← 构建期把 __DEV__ 换成字面量
})
```

同一份源码，两遍打包：development（`__DEV__: 'true'`，不压缩）与 production
（`__DEV__: 'false'`，Closure Compiler 压缩）。`if (false)` 分支在压缩阶段直接 DCE，
**dev 检查、prod 干净**——这就是 React 的"一个源码两副面孔"。

## 我们动手：mini-实现

仓库 `scripts/` 复刻了同一套骨架：

```
scripts/
├── config.js            # bundles.js：声明式矩阵
├── build.js             # build.js：矩阵循环
├── plugins.js           # getPlugins：esbuild 转译 → replace(__DEV__) → terser(prod)
├── forks.js             # external 策略 + resolveId 折叠
└── utils/
    ├── forked-rollup.js # 一个 (bundle, format, env) → 一份 RollupOptions
    ├── names.js         # 产物命名约定
    └── validate.js      # 构建自检（UMD 不允许出现 process / __DEV__）
```

矩阵本体就是一张表：

```js
export const bundles = [
  {
    id: 'react',
    entryPoint: 'packages/react/src/index.ts',
    name: 'react',
    formats: [FORMATS.esm, FORMATS.cjs, FORMATS.umd],
    envs: [ENVS.development, ENVS.production],
    globalName: 'React',
  },
  // react-jsx-runtime（esm/cjs） …
  // react-dom（esm/cjs/umd，external: ['@mini-react/react']）…
];
```

跑 `pnpm build` 会产出 16 个产物，命名与官方一致：

```
packages/react/dist/
├── esm/react.development.mjs        react.production.min.mjs
├── cjs/react.development.js         react.production.min.js
└── umd/react.development.js         react.production.min.js
```

## 两个值得展开的设计点

### 1) UMD 为什么不能出现 `process`？

`<script>` 标签没有 Node 环境，`process.env.NODE_ENV` 会直接抛错。
所以 UMD 的 `__DEV__` 必须**构建期换成字面量**，任何 `process` 引用都不能存活。
`scripts/utils/validate.js` 会在打包后 grep 产物：UMD 里出现 `process.env` 或残留 `__DEV__` 就判失败。

这也是"构建期替换 > 运行时读 NODE_ENV"的根本原因。

### 2) external 与"跨 bundle 单例"

React 的多仓库包之间不是随便打平就完事。`shared`、`scheduler` 这种实现细节会被**内联**进消费包，
但 `react` 必须被 `react-dom` **external**：否则 react 和 react-dom 各带一份 `ReactSharedInternals`，
Hooks 的总线就会断成两段。本仓库用 globalThis 注册单例做了双保险（见第 6 章 hooks 时验证）。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| 矩阵声明 | bundles.js（500+ bundleTypes） | config.js（16 个产物） |
| 压缩 | Closure Compiler | terser |
| 构建期常量 | `__DEV__` / `__PROFILE__` / `__EXPERIMENTAL__` … | 仅 `__DEV__` + NODE_ENV |
| NODE_ENV 选择器 | `index.js` shim | package.json `exports.development/default` 条件 |
| 产物类型 | cjs/esm/umd × dev/prod/profiling | cjs/esm/umd × dev/prod |

## 验证

```bash
pnpm build            # 16 个产物 + validate 自检
pnpm playground:build # 从 dist 消费（exports 冒烟测试）
```

打开 `packages/react/dist/umd/react.production.min.js`，全文搜不到 `process`——这个"干净"就是构建期替换的证据。
