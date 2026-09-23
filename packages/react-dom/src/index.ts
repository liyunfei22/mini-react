// @mini-react/react-dom —— DOM 渲染器（对应官方 packages/react-dom）。
//
// 注意第 1 步：模块加载即注入 HostConfig。官方在构建期做这件事（rollup fork），
// 我们改为运行期做 —— 这是 renderer 可插拔设计的最小演示（详见 HostConfig.ts 顶部注释）。
import {
  createContainer,
  flushSyncCallbacks,
  initializeHostConfig,
  updateContainer,
} from '@mini-react/react-reconciler';
import type { FiberRootNode } from '@mini-react/react-reconciler';
import { ReactDOMHostConfig } from './ReactDOMHostConfig';
import { attachRootListeners } from './events/DOMEventSystem';

initializeHostConfig(ReactDOMHostConfig);

/**
 * createRoot 返回的句柄 —— 对应官方 packages/react-dom/src/client/ReactDOMRoot.js 的 ReactDOMRoot。
 */
export class ReactDOMRoot {
  private _internalRoot: FiberRootNode;
  private _container: Element | DocumentFragment;

  constructor(container: Element | DocumentFragment) {
    this._container = container;
    // 官方这一步发生在 createRoot 里：建 FiberRoot，与容器绑定
    this._internalRoot = createContainer(container);
    // 根委托：在容器上注册一次事件监听（合成事件系统，第 13 章）
    attachRootListeners(container);
  }

  /**
   * 渲染一棵 element 树。第 4 章：同步 flush（对齐 legacy render 的即时语义）；
   * 第 16 章换成 createRoot 真正的并发调度（scheduleUpdateOnFiber 走 Scheduler）。
   */
  render(element: unknown): void {
    updateContainer(element, this._internalRoot);
    flushSyncCallbacks();
  }

  unmount(): void {
    // 第 5 章（删除 + commit 的 Snapshot/布局阶段）实现
    throw new Error('[react-dom] unmount 待第 5 章实现。');
  }
}

/** createRoot —— React 18 的入口（替换 legacy render） */
export function createRoot(container: Element | DocumentFragment): ReactDOMRoot {
  return new ReactDOMRoot(container);
}

/** hydrateRoot —— 服务端渲染水合（本系列不实现 SSR，先占位） */
export function hydrateRoot(
  _container: Element | DocumentFragment,
  _initialChildren: unknown,
): unknown {
  throw new Error('[react-dom] hydrateRoot 未实现（本系列不做 SSR）。');
}
