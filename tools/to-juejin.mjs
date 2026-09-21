#!/usr/bin/env node
// ============================================================================
// to-juejin.mjs —— 发布辅助：frontmatter 校验 → 剥 frontmatter → 检查图片 → 打发布清单
// 用法：node tools/to-juejin.mjs            # 全部
//       node tools/to-juejin.mjs 02         # 只处理系列号为 02 的那篇
// 掘金没有正式发布 API，工作流就是「本脚本出纯正文 + 清单，手动粘贴」。
// ============================================================================
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter, stripFrontmatter, validateFrontmatter } from './frontmatter.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const filter = process.argv[2] ?? '';

/** 找出所有文章 */
function findArticles() {
  const articlesDir = resolve(repoRoot, 'articles');
  return readdirSync(articlesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
    .map((d) => {
      const indexMd = resolve(articlesDir, d.name, 'index.md');
      const exists = (() => {
        try {
          readFileSync(indexMd, 'utf8');
          return true;
        } catch {
          return false;
        }
      })();
      return { dir: d.name, indexMd, exists };
    })
    .filter((a) => a.exists)
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

function collectImageRefs(body) {
  const refs = [];
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(body))) refs.push(m[1]);
  return refs;
}

function main() {
  const articles = findArticles().filter(
    (a) => filter === '' || a.dir.startsWith(filter.padStart(2, '0')),
  );

  let anyIssue = false;
  for (const article of articles) {
    const md = readFileSync(article.indexMd, 'utf8');
    const { frontmatter, body } = parseFrontmatter(md);
    const errors = validateFrontmatter(frontmatter);
    const imageRefs = collectImageRefs(body);

    const problems = [...errors];
    for (const url of imageRefs) {
      if (url.startsWith('http')) {
        if (/cdn\.jsdelivr\.net/.test(url) === false) {
          problems.push(`图片建议用 jsDelivr（当前：${url}）`);
        }
      } else {
        problems.push(`本地图片引用「${url}」—— 掘金需要外链，请先上传图床（如 jsDelivr@GitHub）`);
      }
    }

    console.log(`\n===== ${article.dir} =====`);
    console.log(`标题：${frontmatter.title ?? '(缺)'}`);
    console.log(`摘要：${frontmatter.summary ?? '(缺)'}`);
    console.log(`标签：${Array.isArray(frontmatter.tags) ? frontmatter.tags.join(' / ') : '(缺)'}`);
    console.log(`封面：${frontmatter.cover ?? '(缺)'}`);
    console.log(`原文地址：${frontmatter.originalSource ?? '(缺)'}`);
    console.log(
      `状态：${frontmatter.draft === false ? '√ 可发布' : 'draft（脚本默认跳过人工复核项）'}`,
    );

    if (problems.length > 0) {
      anyIssue = true;
      console.log('⚠ 发布前需处理：');
      problems.forEach((p) => console.log(`   - ${p}`));
    } else {
      console.log('✓ frontmatter 与图片引用均通过');
    }

    // 输出纯正文（掘金不读 frontmatter）
    const bodyFile = resolve(repoRoot, 'articles', article.dir, '.juejin-body.md');
    writeFileSync(bodyFile, stripFrontmatter(md) + '\n');
    console.log(`  纯正文（已剥 frontmatter）→ ${bodyFile.replace(repoRoot, '.')}`);
  }

  if (anyIssue) {
    console.log('\n存在待处理项，建议处理后再粘贴发布。');
    process.exitCode = 1;
  } else {
    console.log('\n全部文章就绪：粘贴 .juejin-body.md 到掘金编辑器，按上面对应字段填发布弹窗。');
  }
}

main();
