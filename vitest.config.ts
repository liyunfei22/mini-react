import { defineConfig } from 'vitest/config';
import type { Alias } from 'vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);

// @mini-react/* 直连包源码（与 apps/playground/vite.config.ts 保持一致的映射）。
// 正则锚定：避免 '@mini-react/react' 前缀匹配误吞 '/jsx-runtime' 子路径。
const source = (fromRoot: string) => resolve(root, 'packages', fromRoot);

const alias: Alias[] = [
  { find: /^@mini-react\/shared$/, replacement: source('shared/src/index.ts') },
  { find: /^@mini-react\/scheduler$/, replacement: source('scheduler/src/index.ts') },
  { find: /^@mini-react\/react$/, replacement: source('react/src/index.ts') },
  { find: /^@mini-react\/react\/jsx-runtime$/, replacement: source('react/src/jsx-runtime.ts') },
  { find: /^@mini-react\/react\/jsx-dev-runtime$/, replacement: source('react/src/jsx-dev-runtime.ts') },
  { find: /^@mini-react\/react-reconciler$/, replacement: source('react-reconciler/src/index.ts') },
  { find: /^@mini-react\/react-dom$/, replacement: source('react-dom/src/index.ts') },
  { find: /^@mini-react\/react-dom\/client$/, replacement: source('react-dom/src/client.ts') },
];

export default defineConfig({
  resolve: { alias },
  define: { __DEV__: 'true' },
  test: {
    environment: 'node',
    include: ['packages/**/__tests__/**/*.test.ts'],
  },
});