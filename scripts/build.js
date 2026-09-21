#!/usr/bin/env node
// ============================================================================
// build.js —— 打包脚手架入口（对应官方 scripts/rollup/build.js）
// ============================================================================
// 用法：
//   node scripts/build.js            # 全矩阵
//   node scripts/build.js react-dom  # 只打 id 包含 react-dom 的 bundle（调试）
// ============================================================================
import { statSync } from 'node:fs';
import { relative } from 'node:path';
import { rollup } from 'rollup';
import { bundles } from './config.js';
import { createRollupOptions } from './utils/forked-rollup.js';
import { getOutputRelPath } from './utils/names.js';
import { validateArtifacts, validateConfig } from './utils/validate.js';

const repoRoot = process.cwd();
const filter = process.argv.slice(2).find((a) => !a.startsWith('-'));

const failures = [];

async function buildOne(bundle, env, format) {
  const options = createRollupOptions(bundle, env, format);
  try {
    const built = await rollup(options);
    await built.write(options.output);
    const file = options.output.file;
    const kb = (statSync(file).size / 1024).toFixed(1);
    console.log(`      ✔ ${relative(repoRoot, file)}  (${kb} KB)`);
  } catch (error) {
    failures.push(`[${bundle.id} · ${format.id} · ${env.env}] ${error.message}`);
  }
}

async function main() {
  // 0) 配置自检
  const configErrors = validateConfig(bundles);
  if (configErrors.length > 0) {
    console.error('配置校验失败：\n' + configErrors.join('\n'));
    process.exit(1);
  }

  // 1) 展开矩阵（bundle × format × env）
  const jobs = [];
  for (const bundle of bundles) {
    if (filter && !bundle.id.includes(filter)) continue;
    for (const format of bundle.formats) {
      for (const env of bundle.envs) {
        jobs.push({ bundle, format, env });
      }
    }
  }

  console.log(
    `mini-react build —— 共 ${jobs.length} 个产物${filter ? `（过滤：${filter}）` : ''}\n`,
  );

  // 2) 顺序构建：学习仓库的可读性优先于并发收益
  for (const { bundle, format, env } of jobs) {
    console.log(`▶ ${bundle.id} · ${format.id} · ${env.env}`);
    await buildOne(bundle, env, format);
  }

  // 3) 产物自检（存在性 + UMD 无 process / 无 __DEV__ 残留）
  const artifacts = jobs.map(({ bundle, format, env }) => ({
    bundle,
    format,
    env,
    outputRel: getOutputRelPath(bundle, format, env),
  }));
  const artifactErrors = validateArtifacts(artifacts);

  const allErrors = [...failures, ...artifactErrors];
  if (allErrors.length > 0) {
    console.error('\n❌ 构建失败：\n' + allErrors.map((e) => '  - ' + e).join('\n'));
    process.exit(1);
  }

  console.log('\n✅ 全部产物就绪。');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
