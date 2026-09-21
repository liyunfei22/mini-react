// @mini-react/react-dom —— DOM 渲染器（对应官方 packages/react-dom 的 index）。
//
// 注意第 1 行：模块加载即注入 HostConfig。为什么在"README 无任何真实渲染"的骨架阶段就做？
// 因为官方 react 在构建期做这件事（rollup fork），我们改为运行期做 —— 这个注入点是
// renderer 可插拔设计的最小演示，第 4 章起 reconciler 的全部调用都经由它。
import { initializeHostConfig } from '@mini-react/react-reconciler';
import { ReactDOMHostConfig } from './ReactDOMHostConfig';

initializeHostConfig(ReactDOMHostConfig);

function notImplemented(name: string): unknown {
  throw new Error(`[react-dom] ${name} 待第 4 章（首屏挂载）实现。`);
}

/** createRoot —— React 18 的入口（替换 legacy render） */
export function createRoot(container: Element | DocumentFragment): unknown {
  return notImplemented(`createRoot(${String(container)})`);
}

/** hydrateRoot —— 服务端渲染水合（本系列不实现 SSR，先占位） */
export function hydrateRoot(_container: Element | DocumentFragment, _initialChildren: unknown): unknown {
  return notImplemented('hydrateRoot');
}