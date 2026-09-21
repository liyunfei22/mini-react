// ESLint flat config（ESLint 10）
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // 构建产物与生成物不 lint
    ignores: ['**/dist/**', '**/dist-types/**', '**/node_modules/**', '**/coverage/**', '**/*.tsbuildinfo'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { import: importX },
    settings: {
      'import-x/resolver': { typescript: true },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 用 import 图守护"包方向"，防循环依赖（react ↔ reconciler 靠 shared 总线解耦）
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',
    },
  },

  prettier,

  {
    // reconciler / scheduler 是「渲染器无关」层：永远不允许反向依赖 react / react-dom
    files: ['packages/react-reconciler/**', 'packages/scheduler/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@mini-react/react', '@mini-react/react-dom'] },
      ],
    },
  },
);