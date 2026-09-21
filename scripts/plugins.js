// ============================================================================
// plugins.js —— 全矩阵共享的插件管线（对应官方 scripts/rollup/build.js 的 getPlugins）
// ============================================================================
// 顺序敏感：
//   fold(workspace)  →  resolveId 重写，先于任何解析
//   esbuild          →  TS/JSX 转译（只做语法层，不做 tree-shaking）
//   replace(__DEV__) →  构建期把 __DEV__ 与 process.env.NODE_ENV 替换成字面量
//   terser(prod)     →  production 才启用，把 if(false) 分支 DCE 掉
import esbuild from 'rollup-plugin-esbuild';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { foldWorkspacePlugin } from './forks.js';

/**
 * @param {{ id: string, externals?: string[] }} bundle
 * @param {{ env: string, dev: boolean }} env
 * @param {{ id: string }} format
 */
export function getPlugins(bundle, env, _format) {
  const plugins = [
    foldWorkspacePlugin(bundle),
    // @rollup/plugin-esbuild 从 registry 消失后，用同生态的 rollup-plugin-esbuild（能力等价）
    esbuild({
      target: 'es2019',
      jsx: 'automatic',
      jsxImportSource: '@mini-react/react',
      sourceMap: true,
    }),
    replace({
      values: {
        // UMD 全局脚本没有 Node 环境，绝不能出现 process —— 这就是构建期替换的意义
        __DEV__: env.dev ? 'true' : 'false',
        'process.env.NODE_ENV': JSON.stringify(env.env),
      },
      preventAssignment: true, // 防止误替换成赋值表达式
    }),
  ];

  if (env.minify) {
    plugins.push(
      terser({
        format: { comments: /@license|@preserve/ }, // 保留 license 头
      }),
    );
  }

  return plugins;
}
