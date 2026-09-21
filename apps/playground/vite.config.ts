import { defineConfig } from 'vite';
import type { Alias } from 'vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);

// @mini-react/* 直连包源码（与 vitest.config.ts 保持一致的映射）。
// 关键设计：
// - dev（vite dev，mode=development）：alias 生效 → 包源码直达浏览器，零构建热更；
// - build（vite build，mode=production）：alias 关闭 → 走各包 package.json 的 exports → dist，
//   等价于"真实用户在装好的包里消费"，因此 playground:build 成功与否就是 exports 冒烟测试。
// 使用"正则锚定"而不是对象前缀匹配：避免 '@mini-react/react' 误吞 '/jsx-runtime' 等子路径。
const source = (fromRoot: string) => resolve(root, '../../packages', fromRoot);

const alias: Alias[] = [
  { find: /^@mini-react\/shared$/, replacement: source('shared/src/index.ts') },
  { find: /^@mini-react\/scheduler$/, replacement: source('scheduler/src/index.ts') },
  { find: /^@mini-react\/react$/, replacement: source('react/src/index.ts') },
  { find: /^@mini-react\/react\/jsx-runtime$/, replacement: source('react/src/jsx-runtime.ts') },
  {
    find: /^@mini-react\/react\/jsx-dev-runtime$/,
    replacement: source('react/src/jsx-dev-runtime.ts'),
  },
  { find: /^@mini-react\/react-reconciler$/, replacement: source('react-reconciler/src/index.ts') },
  { find: /^@mini-react\/react-dom$/, replacement: source('react-dom/src/index.ts') },
  { find: /^@mini-react\/react-dom\/client$/, replacement: source('react-dom/src/client.ts') },
];

const workspacePackages = [
  '@mini-react/shared',
  '@mini-react/scheduler',
  '@mini-react/react',
  '@mini-react/react-reconciler',
  '@mini-react/react-dom',
];

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    resolve: {
      alias: isDev ? alias : undefined,
      dedupe: workspacePackages,
    },
    optimizeDeps: {
      exclude: workspacePackages,
    },
    server: {
      fs: { allow: [resolve(root, '../..')] },
    },
    esbuild: {
      // 显式声明自动运行时（tsconfig 已声明，这里双保险）
      jsx: 'automatic',
      jsxImportSource: '@mini-react/react',
    },
  };
});
