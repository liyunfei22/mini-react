import { defineConfig } from 'vitepress';
import { chaptersSidebar } from './chapters';

// GitHub Pages 项目站点：仓库 liyunfei22/mini-react → 访问路径 /mini-react/
// docs:build 产物在 docs/.vitepress/dist，由 .github/workflows/deploy-docs.yml 发布。
export default defineConfig({
  base: '/mini-react/',
  lang: 'zh-CN',
  title: 'mini-react 源码解析',
  description:
    '从零手写 React 18（含并发）：Fiber、Hooks、事件、Diff、Scheduler、Lane、并发渲染、Suspense —— 逐章对照官方 v18.2.0 源码。',
  cleanUrls: true,
  // 生成期不去校验绝对外链（掘金原文 / jsDelivr 封面等偶尔不可达，不该阻塞构建）
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: '章节路线', link: '/chapters/00-系列导读' },
      { text: 'GitHub 仓库', link: 'https://github.com/liyunfei22/mini-react' },
    ],
    sidebar: {
      '/chapters/': chaptersSidebar,
    },
    outline: {
      label: '本页目录',
      level: [2, 3],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/liyunfei22/mini-react' }],
    footer: {
      message: '从零手写 React 18（含并发）· 对照官方 v18.2.0 源码',
      copyright: 'MIT Licensed · liyunfei22',
    },
    search: {
      provider: 'local',
    },
  },
});