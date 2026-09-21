// ============================================================================
// forks.js —— 工作区依赖的"内联 vs 外联"策略 + resolveId 折叠
// 对应官方 scripts/rollup/forks.js（use-forks-plugin.js 的 resolveId 重写表）。
// ============================================================================
// 学习点：
//   1. Rollup 默认把 import 图里所有模块打平进 bundle。对 monorepo 来说：
//      - 实现细节（shared / scheduler / react-reconciler）→ 内联打进消费包（external: []）；
//      - 必须与宿主共享模块身份的包（react）→ 设 external，运行时解析到同一次安装。
//   2. 裸包名 '@mini-react/shared' 会被 `resolveId` 折叠到它的 src 入口 ——
//      保证打进 bundle 的是 **TS 源码**（而不是这个包的 dist 或 main 字段），
//      这就是"forks"的含义：import 路径在构建期被重写到指定源文件。
import { resolve } from 'node:path';

const repoRoot = process.cwd();

/**
 * 每一个 external 的工作区包在 UMD 场景下的全局变量名（validate 会强制覆盖到）。
 * 学习点：script 标签模式没有模块系统，external 的包必须由"全局变量"提供 ——
 * 例如 react-dom 的 UMD 构建里 `require('react')` 编译成 `global.React`。
 */
export const UMD_GLOBALS = {
  '@mini-react/react': 'React',
};

/** 内联到各消费包的工作区包及其源码入口 */
const INLINE_PACKAGE_ENTRIES = {
  '@mini-react/shared': 'packages/shared/src/index.ts',
  '@mini-react/scheduler': 'packages/scheduler/src/index.ts',
  '@mini-react/react-reconciler': 'packages/react-reconciler/src/index.ts',
};

/**
 * 每个 bundle 的折叠插件。
 * @param {{ externals?: string[] }} bundle
 */
export function foldWorkspacePlugin(bundle) {
  const externalsSet = new Set(bundle.externals ?? []);
  return {
    name: 'fold-workspace-packages',
    resolveId(source, _importer) {
      // 1) external 包：原样放行（保持裸说明符；UMD 时由 globals 映射到全局变量）
      if (externalsSet.has(source)) {
        return { id: source, external: true };
      }
      // 2) 需要内联的工作区包：折叠到 src 源码入口
      const target = INLINE_PACKAGE_ENTRIES[source];
      if (target) {
        return resolve(repoRoot, target);
      }
      return null; // 其余交给后续插件/默认解析
    },
  };
}