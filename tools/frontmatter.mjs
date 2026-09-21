// ============================================================================
// frontmatter.mjs —— 仓库内文章的 frontmatter：解析 / 校验 / 剥离
// 掘金不识别 frontmatter：这些字段仅用于仓库侧管理 + tools 脚本决策。
// 字段与约定（对应 articles/README.md）：
//   title / summary / tags[3-5] / cover / date(YYYY-MM-DD)
//   series / seriesIndex / originalSource / draft(控制脚本是否参与)
// ============================================================================

export const REQUIRED_FIELDS = ['title', 'summary', 'tags', 'date', 'series', 'seriesIndex'];

export const SERIES_NAME = 'mini-react 源码解析';

/** 从 markdown 切出 frontmatter 与正文 */
export function parseFrontmatter(md) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  if (!match) {
    return { frontmatter: {}, body: md };
  }
  const body = md.slice(match[0].length);
  const frontmatter = {};
  const allowed = new Set([...REQUIRED_FIELDS, 'cover', 'originalSource', 'draft']);

  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!allowed.has(key)) continue;
    let value = line.slice(idx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (/^\d+$/.test(value)) {
      value = Number(value);
    } else if (/^(true|false)$/.test(value)) {
      value = value === 'true';
    }
    frontmatter[key] = value;
  }
  return { frontmatter, body };
}

/** 校验必需字段（掘金发布前先过一遍） */
export function validateFrontmatter(frontmatter) {
  const errors = [];
  for (const key of REQUIRED_FIELDS) {
    const value = frontmatter[key];
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      errors.push(`缺少必需字段：${key}`);
    }
  }
  const tags = frontmatter.tags;
  if (!Array.isArray(tags) || tags.length < 3 || tags.length > 5) {
    errors.push('tags 应为 3~5 个（掘金选标签推荐区间）');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(frontmatter.date ?? ''))) {
    errors.push('date 格式应为 YYYY-MM-DD');
  }
  if (typeof frontmatter.seriesIndex !== 'number') {
    errors.push('seriesIndex 应为数字（系列顺序）');
  }
  return errors;
}

/** 剥离 frontmatter，输出纯正文（粘贴到掘金编辑器前用） */
export function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '');
}
