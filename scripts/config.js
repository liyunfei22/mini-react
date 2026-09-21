// ============================================================================
// config.js —— 声明式打包矩阵（对应官方 scripts/rollup/bundles.js）
// ============================================================================
// 核心思想：不做"每个包一个 rollup 配置文件"，而是一张数据表 × 三重循环（bundle × format × env）。
// 学习点：
//   1. React 500+ 个产物（bundleTypes 矩阵）就是这一张表的笛卡尔积；
//   2. 每个 bundle 声明：入口、输出名、支持格式、支持环境、（可选）external 与 UMD 全局名；
//   3. 同一份 TS 源码 → development（不压缩、__DEV__=true）与 production（terser、__DEV__=false，if(false) 被 DCE）。
// 打包变体约束（与官方 react-dom 一致）：
//   - 'react' 与 'react-dom' 有 UMD（script 标签可用，global 名 React / ReactDOM）；
//   - react-dom 对 'react' 设为 external：保证与用户手里的 react 是同一模块单例
//     （ReactCurrentOwner、ReactSharedInternals 才连得上，Hooks 章节会验证）。

export const FORMATS = {
  esm: { id: 'esm', dir: 'esm', ext: '.mjs' },
  cjs: { id: 'cjs', dir: 'cjs', ext: '.js' },
  umd: { id: 'umd', dir: 'umd', ext: '.js' },
};

export const ENVS = {
  development: { env: 'development', dev: true, minify: false },
  production: { env: 'production', dev: false, minify: true },
};

/**
 * @typedef {Object} BundleConfig
 * @property {string} id          包的逻辑名（用于日志/过滤）
 * @property {string} entryPoint  入口（相对仓库根）
 * @property {string} name        产物名（packages/<packageName>/dist/<dir>/<name>.development.js 等）
 * @property {string} packageName 落到哪个包的 dist 下
 * @property {string[]} formats
 * @property {string[]} envs
 */

export const bundles = [
  {
    id: 'react',
    entryPoint: 'packages/react/src/index.ts',
    name: 'react',
    packageName: 'react',
    formats: [FORMATS.esm, FORMATS.cjs, FORMATS.umd],
    envs: [ENVS.development, ENVS.production],
    globalName: 'React', // UMD 暴露的全局变量名
    externals: [],
  },
  {
    id: 'react-jsx-runtime',
    entryPoint: 'packages/react/src/jsx-runtime.ts',
    name: 'react-jsx-runtime',
    packageName: 'react', // 属于 react 包（exports: "./jsx-runtime"）
    formats: [FORMATS.esm, FORMATS.cjs],
    envs: [ENVS.development, ENVS.production],
    externals: [],
  },
  {
    id: 'react-dom',
    entryPoint: 'packages/react-dom/src/index.ts',
    name: 'react-dom',
    packageName: 'react-dom',
    formats: [FORMATS.esm, FORMATS.cjs, FORMATS.umd],
    envs: [ENVS.development, ENVS.production],
    globalName: 'ReactDOM',
    externals: ['@mini-react/react'],
  },
].map((b) => Object.freeze(b));