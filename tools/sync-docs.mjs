#!/usr/bin/env node
// ============================================================================
// sync-docs.mjs —— 把 articles/NN-slug/index.md 同步成 VitePress 文档站点内容
//   1. 每篇 → docs/chapters/NN-slug.md（剥掘金 frontmatter，换成 VitePress 用 title/description）
//   2. 生成 docs/.vitepress/chapters.ts（侧边栏数据，按系列号排序）
// 用法：node tools/sync-docs.mjs（改文章后重跑一次即可）
// ============================================================================
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const articlesDir = resolve(repoRoot, 'articles');
const docsDir = resolve(repoRoot, 'docs');
const chaptersDir = resolve(docsDir, 'chapters');

const entries = readdirSync(articlesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
  .sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(chaptersDir, { recursive: true });
mkdirSync(resolve(docsDir, '.vitepress'), { recursive: true });

const sidebar = [];

for (const entry of entries) {
  const slug = entry.name; // 如 02-createElement与JSX运行时
  const nn = slug.slice(0, 2); // 01 / 02 / ...
  const indexMd = resolve(articlesDir, slug, 'index.md');
  const md = readFileSync(indexMd, 'utf8');
  const { frontmatter, body } = parseFrontmatter(md);

  const title = frontmatter.title ?? slug;
  // 掘金 title 形如「React 源码解析 NN：……」，侧边栏剥掉前缀做短标签
  const shortTitle = title.replace(/^React 源码解析 \d{2}：/, '');

  // 剥掉正文的首个 H1（# 问题：…）——VitePress 用 frontmatter.title 做页标题，避免重复标题
  const bodyWithoutH1 = body.replace(/^\n*# .+(\r?\n|$)/, '\n');

  const doc = ['---', `title: ${title}`, `description: ${frontmatter.summary ?? ''}`, '---', ''].join(
    '\n',
  );
  writeFileSync(resolve(chaptersDir, `${slug}.md`), `${doc}${bodyWithoutH1.trim()}\n`);

  sidebar.push({ text: `${parseInt(nn, 10)} · ${shortTitle}`, link: `/chapters/${slug}` });
}

const sidebarCode = `// 本文件由 tools/sync-docs.mjs 生成，勿手改。
export interface ChapterItem {
  text: string;
  link: string;
}

export const chaptersSidebar: ChapterItem[] = ${JSON.stringify(sidebar, null, 2)};
`;
writeFileSync(resolve(docsDir, '.vitepress', 'chapters.ts'), sidebarCode);

console.log(`已同步 ${entries.length} 篇 → docs/chapters/（侧边栏 → docs/.vitepress/chapters.ts）`);