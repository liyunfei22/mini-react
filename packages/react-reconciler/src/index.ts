// @mini-react/react-reconciler —— 与 host 无关的 reconciler。
// 骨架阶段：只交付 HostConfig 注入点与两个 API 桩；
// 第 3 章填 Fiber 数据结构，第 4 章起逐步填 render/commit 全链路。
export { initializeHostConfig, hostConfig } from './HostConfig';
export type { HostConfig, Props } from './HostConfig';

/** 创建 FiberRoot（官方 ReactFiberRoot.createContainer 的返回值）—— 第 4 章实现 */
export function createContainer(containerInfo: unknown): never {
  throw new Error(
    '[react-reconciler] createContainer 尚未实现 —— 第 4 章开始填充 Fiber 首屏挂载。',
  );
}

/** 把 element 放进 root 并调度一次渲染 —— 第 4 章实现 */
export function updateContainer(_element: unknown, _container: unknown): never {
  throw new Error(
    '[react-reconciler] updateContainer 尚未实现 —— 第 4 章开始填充。',
  );
}