// ============================================================================
// validate.js —— 构建配置与产物的自检（fail-fast，镜像官方 scripts/rollup/validate/）
// ============================================================================
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { UMD_GLOBALS } from '../forks.js';

const repoRoot = process.cwd();

export function validateConfig(bundles) {
  const errors = [];

  for (const bundle of bundles) {
    // 1) 入口必须存在
    if (!existsSync(resolve(repoRoot, bundle.entryPoint))) {
      errors.push(`[config] 入口不存在：${bundle.entryPoint}`);
    }
    // 2) UMD 必须有全局名（globalName）
    if (bundle.formats.some((f) => f.id === 'umd') && !bundle.globalName) {
      errors.push(`[config] ${bundle.id} 声明了 umd 格式但没有 globalName`);
    }
    // 3) UMD 的每个 external 都必须能在全局变量表里找到映射
    if (bundle.formats.some((f) => f.id === 'umd')) {
      for (const source of bundle.externals ?? []) {
        if (!(source in UMD_GLOBALS)) {
          errors.push(
            `[config] ${bundle.id} 的 external '${source}' 没有 UMD 全局映射（见 forks.js 的 UMD_GLOBALS）`,
          );
        }
      }
    }
  }
  return errors;
}

/** 校验产物：文件存在且非空；UMD 不含 process、不含残留 __DEV__ */
export function validateArtifacts(artifacts) {
  const errors = [];
  for (const { bundle, format, outputRel } of artifacts) {
    const file = resolve(repoRoot, 'packages', bundle.packageName, outputRel);
    if (!existsSync(file)) {
      errors.push(`[artifact] 产物缺失：${outputRel}`);
      continue;
    }
    const stat = statSync(file);
    if (stat.size === 0) {
      errors.push(`[artifact] 产物为空：${outputRel}`);
      continue;
    }
    if (format.id === 'umd') {
      const content = readFileSync(file, 'utf8');
      // 全局脚本没有 Node 环境：process 引用必须为 0（__DEV__/NODE_ENV 都已被构建期替换）
      if (/process\.env/.test(content)) {
        errors.push(`[artifact] UMD 产物引用了 process.env：${outputRel}`);
      }
      if (/\b__DEV__\b/.test(content)) {
        errors.push(`[artifact] UMD 产物残留 __DEV__（应已被替换）：${outputRel}`);
      }
    }
  }
  return errors;
}
