# mini-react —— 从零手写 React 18（含并发）

> 一个用 TypeScript 从 0 到 1 手写 React 18 源码的学习仓库。目标不是"复刻一个能用的库"，
> 而是**读懂 React 原理与源码设计**：每一章 = 一段可运行的源码实现 + 一篇掘金技术文章 + 一个 playground demo。

- 技术栈：TypeScript（strict）· pnpm workspaces · Vitest · Rollup（打包脚手架）· Vite（playground）
- 特性范围：React 18「核心 + 并发」—— Fiber、Hooks、事件系统、Diff、Context、Refs、Scheduler、Lane、可中断渲染、useTransition
- 专栏：`articles/` 每章一文，系列发布到掘金（`tools/` 提供发布辅助）

## 快速开始

```bash
pnpm install
pnpm check          # typecheck → test → build(16 产物) → playground build（exports 冒烟）
pnpm playground:dev # 打开演示台（dev 态直连包源码，零构建）
pnpm build          # 只打包（见"打包脚手架"）
```

## 仓库结构

```
mini-react/
├── packages/
│   ├── react/                 # 用户侧 API：createElement / JSX 运行时 / hooks 入口（对官方 packages/react）
│   ├── react-reconciler/      # 与 host 无关的 Fiber / 渲染 / 提交 / hooks（对官方 react-reconciler）
│   ├── react-dom/             # DOM 渲染器 + 事件系统（对官方 react-dom）
│   ├── scheduler/             # 时间切片调度器（对官方 scheduler，第 14 章填充）
│   ├── shared/                # 共享工具 + 跨包总线 ReactSharedInternals
│   └── react-test-renderer/   # 内存 Host，reconciler 单测用
├── apps/playground/           # 演示台：dev alias 直连源码；build 走 dist（exports 冒烟）
├── scripts/                   # 打包脚手架（对官方 scripts/rollup 的迷你镜像）
├── tools/                     # 掘金专栏工具（frontmatter / new-article / to-juejin）
└── articles/                  # 技术专栏（frontmatter + assets + 进度表）
```

## 打包脚手架（`scripts/`，对官方 `scripts/rollup`）

不是"每个包一个配置文件"，而是**一张声明式打包矩阵 × 三重循环（bundle × format × env）**：

| 文件                     | 对应官方              | 职责                                                 |
| ------------------------ | --------------------- | ---------------------------------------------------- |
| `config.js`              | `bundles.js`          | 矩阵数据（16 个产物）                                |
| `build.js`               | `build.js`            | 矩阵循环 + 产物自检                                  |
| `plugins.js`             | `build.js getPlugins` | esbuild 转译 → `replace(__DEV__)` → prod 加 terser   |
| `forks.js`               | `forks.js`            | external 策略 + resolveId 折叠（工作区包内联到源码） |
| `utils/forked-rollup.js` | `utils.js`            | 一个 (bundle, format, env) → 一份 RollupOptions      |
| `utils/names.js`         | `packaging.js`        | 产物命名                                             |
| `utils/validate.js`      | `validate/`           | 幂等 + UMD 无 `process`/`__DEV__` 残留               |

关键机制：**`__DEV__` 构建期替换**。同一份源码打两遍：

- development：`__DEV__` → `true`，不压缩（产物带全部 dev 校验）
- production：`__DEV__` → `false` + terser，`if (false)` 分支被 DCE

产物命名与官方一致：`dist/esm/react.development.mjs` / `dist/cjs/react.production.min.js` / `dist/umd/react.development.js` 等。

已知简化（README 与官方差异的自白）：

1. `react-dom/client` 不单独出包：package.json `exports` 把 `./client` 映射到主包同一产物
   （官方是 node_modules 里的 NODE_ENV chooser shim）。
2. 没有 `NODE_ENV` 选择器 `index.js`：用 exports 的 `development`/`default` 条件替代。
3. 压缩器从 Closure Compiler 换成 terser；不产 profiling 变体。

## 模块依赖规则（防循环 = 教学重点）

```
apps/playground ─▶ @mini-react/react / react-dom（仅 apps 层可 import react-dom）
@mini-react/react      ─▶ @mini-react/shared
@mini-react/react-dom  ─▶ react、react-reconciler、shared、scheduler（react 设为 external）
@mini-react/react-reconciler ─▶ shared、scheduler（永不含 react / react-dom）
@mini-react/scheduler  ─▶（无）     @mini-react/shared  ─▶ (无)
```

- **跨包总线**：`shared/ReactSharedInternals.ts` 是 hooks 运行时的单例总线——reconciler 写、react 读。
  单例注册在 `globalThis`（key：`__MINI_REACT_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`），
  保证即使 react 与 react-dom 各自内联了 shared，读写的仍是同一个对象（与官方 `__REACT_DEVTOOLS_GLOBAL_HOOK__` 同思路）。
- **HostConfig 解耦**：官方在构建期用 rollup fork 选择 host 实现；本仓库改为运行期注入
  （`react-dom` / `react-test-renderer` 模块加载时调 `initializeHostConfig`），reconciler 统一经 `hostConfig.xxx()` 访问。
- eslint 的 `no-restricted-imports` + `import-x/no-cycle` 守护上述方向。

## 章节路线图（每章 = 一段代码 + 一篇文章 + 一个 demo）

| 篇    | 主题                                                 | 状态                                  |
| ----- | ---------------------------------------------------- | ------------------------------------- |
| 00    | 系列导读                                             | ✅ 草稿待发（articles/00）            |
| 01    | React 是怎么打包的：还原 scripts/rollup 式构建脚手架 | ✅ 草稿待发（articles/01）            |
| 02    | createElement 与 JSX 运行时                          | ✅ 已完成（packages/react + 23 单测） |
| 03    | Fiber 数据结构与双缓冲                               | ✅ 已完成                             |
| 04    | 首屏挂载全链路：render(workLoopSync)                 | ✅ 已完成                             |
| 05    | 提交阶段 commitRoot                                  | 🕐 未开始                             |
| 06~10 | Hooks 全家桶                                         | 🕐 未开始                             |
| 11~13 | Context / refs / 合成事件                            | 🕐 未开始                             |
| 14~16 | Scheduler / Lane / 并发升级                          | 🕐 未开始                             |
| 17    | 发布打磨与全链复盘                                   | 🕐 未开始                             |

> 进度事实源：`articles/README.md`。新增篇章用 `pnpm article:new`（`node tools/new-article.mjs NN slug 标题`）。

## 命令速查

```bash
pnpm check              # typecheck + test + build + playground build（全绿才算过）
pnpm typecheck          # tsc -b（project references，一次驱动全仓）
pnpm test / test:watch  # vitest
pnpm build              # 16 个产物；pnpm build:react-dom 可按 id 过滤
pnpm lint / format      # eslint / prettier
pnpm article:new        # 新文章骨架 + 进度表
pnpm article:juejin     # 发布辅助：剥 frontmatter + 校验图片 + 打清单
```

## Git 与发布工作流

- 每章一个 commit；`main` 分支保持 `pnpm check` 全绿。
- 脚手架（打包体系）即 `scripts/`；`dist/`、`dist-types/`、`node_modules/` 不入库。
- **预留给 GitHub**：本仓库计划推送到 GitHub，作为掘金文章的：
  - `原文地址`（frontmatter 的 `originalSource`）；
  - 图片图床（jsDelivr：`cdn.jsdelivr.net/gh/<user>/mini-react@main/articles/.../assets/xxx.png`）。
    推送到 GitHub 后执行：
  ```bash
  git remote add origin git@github.com:<你的GitHub用户名>/mini-react.git
  git push -u origin main
  ```
  然后把 frontmatter 与图片路径里的 `<你的GitHub用户名>` 替换为真实用户名。

## 学习顺序建议

1. 先跑 `pnpm playground:dev` 看 Demo01 元素树；
2. 读 `scripts/config.js`（01 篇）理解"怎么打包"；
3. 读 `packages/react/src/ReactElement.ts`（02 篇）理解 element 契约；
4. 之后按路线图逐章走：Fiber → 挂载 → commit → hooks → 并发。
   对照阅读法：官方源码以 `facebook/react` **tag v18.2.0** 为准（`github.com/react/react/tree/v18.2.0`）。
