#!/usr/bin/env node
// ============================================================================
// new-article.mjs —— 生成文章骨架并更新 progress 表
// 用法：node tools/new-article.mjs <NN> <slug> <标题>
//   例：node tools/new-article.mjs 03 fiber-data-structure "Fiber 数据结构与双缓冲"
// ============================================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SERIES_NAME } from './frontmatter.mjs';

const [, , nnArg, slug, title] = process.argv;

if (!nnArg || !slug || !title) {
  console.error('用法：node tools/new-article.mjs <NN> <slug> <标题>');
  process.exit(1);
}

const repoRoot = resolve(import.meta.dirname, '..');
const seriesIndex = Number(nnArg.replace(/^0/, '')) || Number(nnArg);
if (!Number.isInteger(seriesIndex)) {
  console.error(`系列编号必须是数字：${nnArg}`);
  process.exit(1);
}

const dirName = `${nnArg.padStart(2, '0')}-${slug}`;
const dir = resolve(repoRoot, 'articles', dirName);
if (existsSync(dir)) {
  console.error(`目录已存在：${dir}`);
  process.exit(1);
}
mkdirSync(resolve(dir, 'assets'), { recursive: true });
writeFileSync(resolve(dir, 'assets', '.gitkeep'), '');

const date = new Date().toISOString().slice(0, 10);
const coverPlaceholder =
  'https://cdn.jsdelivr.net/gh/<你的GitHub用户名>/mini-react@main/articles/' +
  `${dirName}/assets/cover.png`;

const frontmatter = [
  '---',
  `title: ${title}`,
  `summary: 一句话摘要（掘金「摘要」栏用它，预留空）`,
  `tags: [前端, React, 源码分析]`,
  `cover: ${coverPlaceholder}`,
  `date: ${date}`,
  `series: ${SERIES_NAME}`,
  `seriesIndex: ${seriesIndex}`,
  `originalSource: https://github.com/<你的GitHub用户名>/mini-react`,
  'draft: true',
  '---',
].join('\n');

const template = `${frontmatter}

# ${title}

> 系列前缀建议：掘金标题形如「React 源码解析 ${String(seriesIndex).padStart(2, '0')}：……」，
> 这一个 \`${title}\` 是仓库内标题，发布时的头部编号在文章正文或发布弹窗里再确认。

## 问题

（为什么值得读这一章：一段真实场景 / 一个最容易踩的坑）

## 官方实现里发生了什么

（贴源码核心 10~25 行，注释精简；给出 react 仓库 tag v18.2.0 下对应文件路径）

## 我们动手：mini 实现

（与上一节同构的我们自己代码；完整版见仓库对应章节目录）

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| （行为/边界对比） | | |

## 验证

（demo / 单测怎么跑）
`;

writeFileSync(resolve(dir, 'index.md'), template);

console.log(`✅ 已生成：articles/${dirName}/`);

// ---- 更新 articles/README.md 进度表 ----
const readmePath = resolve(repoRoot, 'articles', 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const lines = readme.split('\n');
// 找"| 篇 | 章节 | 状态 | 掘金链接 |"这行表头（比找分隔行更稳）
const headerIdx = lines.findIndex((l) => /^\|\s*篇\s*\|/.test(l));
let inserted = false;
if (headerIdx === -1) {
  console.warn('⚠ articles/README.md 中没找到进度表表头（"| 篇 |"），请手动补一行');
} else {
  // 数据区从表头 + 分隔行之后开始
  let insertAt = headerIdx + 2;
  let existing = false;
  while (
    insertAt < lines.length &&
    lines[insertAt] !== undefined &&
    /^\|\s*\d+/.test(lines[insertAt])
  ) {
    const lineNum = Number((lines[insertAt].match(/^\|\s*(\d+)/) ?? [])[1]);
    if (lineNum === seriesIndex) {
      existing = true; // 已有同编号行（进度表预置），不重复插入
      break;
    }
    if (lineNum > seriesIndex) break; // 找到比新篇章号大的行，插在它前面
    insertAt++;
  }

  if (existing) {
    console.warn(`⏭ 进度表已存在 ${seriesIndex} 号行，跳过插入`);
  } else {
    const newRow = `| ${nnArg.padStart(2, '0')} | ${title} | 🕐 未开始 | — |`;
    lines.splice(insertAt, 0, newRow);
    writeFileSync(readmePath, lines.join('\n'));
    inserted = true;
  }
}
if (inserted) {
  console.log(`   ✅ 进度表已更新：articles/README.md（${title} → 待开始）`);
}
