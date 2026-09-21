// Hooks 运行时"总线"的单例持有者 —— 全仓（及全应用）唯一。
//
// 为什么注册到 globalThis？打包脚手架会把 shared 内联进 react 与 react-dom 两个产物，
// 各产物会持有一份本模块（对象字面量若写在模块顶层则会有两副本）。Hooks 章节的要求是：
// 用户在组件里 useState（react 包读总线），reconciler 渲染时写总线 —— 必须是同一个对象。
// 把单例落在 globalThis 上是 JS 里跨 bundle 保证"只此一份"的标准做法：
// React 官方的 __REACT_DEVTOOLS_GLOBAL_HOOK__ 同样注册在 globalThis 上。
//
// 依赖方向保持干净：本文件不 import react，reconciler / react 都从 '@mini-react/shared' 这一处拿。
import type { Dispatcher, Transition } from './types';

const GLOBAL_KEY = '__MINI_REACT_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED';

interface ReactSharedInternalsShape {
  ReactCurrentDispatcher: { current: Dispatcher | null };
  ReactCurrentBatchConfig: { transition: Transition | null };
}

function createInternals(): ReactSharedInternalsShape {
  return {
    ReactCurrentDispatcher: { current: null },
    ReactCurrentBatchConfig: { transition: null },
  };
}

export const ReactSharedInternals: ReactSharedInternalsShape = (() => {
  const g = globalThis as unknown as Record<string, unknown>;
  const existing = g[GLOBAL_KEY] as ReactSharedInternalsShape | undefined;
  if (existing) {
    return existing;
  }
  const created = createInternals();
  g[GLOBAL_KEY] = created;
  return created;
})();

export default ReactSharedInternals;