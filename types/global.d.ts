/**
 * 全局编译期常量 __DEV__ —— 对应官方 React 源码里的 __DEV__。
 *
 * 三层分工（唯一的事实来源）：
 * 1. 类型：本文件声明，全仓可用；
 * 2. 单测/playground 开发态：vitest.config.ts / vite.config.ts 的 `define: { __DEV__: 'true' }` 替换；
 * 3. 构建产物：scripts/plugins.js 用 rollup replace 分别替换为 true（development）/ false（production），
 *    production 的 if (false) 分支被 terser DCE 掉 —— 这就是 React 一个源码产出 dev/prod 双 bundle 的秘密。
 */
declare const __DEV__: boolean;
