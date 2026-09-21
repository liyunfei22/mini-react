// ============================================================================
// forked-rollup.js —— 把一个 (bundle, format, env) 组装成一份 RollupOptions
// 对应官方 scripts/rollup/utils.js（forkedRollup）+ build.js 的 createBundle 思路。
// ============================================================================
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPlugins } from '../plugins.js';
import { UMD_GLOBALS } from '../forks.js';
import { getOutputRelPath } from './names.js';

const repoRoot = process.cwd();

/** 读取包的版本号用于 license banner */
function readPackageVersion(packageName) {
  try {
    const raw = readFileSync(
      resolve(repoRoot, 'packages', packageName, 'package.json'),
      'utf8',
    );
    return JSON.parse(raw).version ?? '0.0.1';
  } catch {
    return '0.0.1';
  }
}

export function createRollupOptions(bundle, env, format) {
  const isUmd = format.id === 'umd';
  const input = resolve(repoRoot, bundle.entryPoint);
  const outputRel = getOutputRelPath(bundle, format, env);
  const outputFile = resolve(repoRoot, 'packages', bundle.packageName, outputRel);
  const version = readPackageVersion(bundle.packageName);

  const output = {
    file: outputFile,
    format: format.id,
    sourcemap: true,
    banner: `/*! @mini-react/${bundle.id} v${version} */`,
    ...(isUmd ? { name: bundle.globalName, exports: 'named' } : {}),
    // external 的包在 UMD 下由全局变量提供（见 forks.js 的 UMD_GLOBALS）
    ...(isUmd && (bundle.externals?.length ?? 0) > 0
      ? { globals: globalsFor(bundle.externals) }
      : {}),
  };

  return {
    input,
    external: bundle.externals ?? [],
    plugins: getPlugins(bundle, env, format),
    output,
  };
}

/** 为 bundle 声明过的 externals 生成 UMD globals 映射 */
function globalsFor(externals) {
  const globals = {};
  for (const source of externals) {
    globals[source] = UMD_GLOBALS[source];
  }
  return globals;
}