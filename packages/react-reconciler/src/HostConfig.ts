// reconciler 与具体 host（DOM / 测试 renderer）之间的"接头" —— 本文件是架构关键，先看懂再写别处。
//
// 官方 react 的处理：构建期用 rollup 的 resolveId fork（scripts/rollup/forks.js + useForks 插件）
// 把 host 实现按 bundle 替换进去；所以我们能在源码里看到 reconciler 从不 import react-dom。
// mini-repo 的简化：运行期显式注入 —— react-dom / react-test-renderer 在模块加载时
// 调用 initializeHostConfig(...)，reconciler 内部统一经 hostConfig.xxx() 代理访问。
// 从调用形态看，两者逐行同构，只是"连接点"的时机不同（构建期 vs 运行期）——这正是文章要讲的设计。

/** 渲染器看到的 props（宽松类型，宿主实现负责消费） */
export type Props = Record<string, unknown>;

/** 最小 Host 接口：13 个成员，覆盖挂载/更新/删除/文本 四类 DOM 操作 */
export interface HostConfig {
  /** 根容器的上下文（DOM 实现可返回 document 对应的命名空间等） */
  getRootHostContext(rootContainer: unknown): unknown;
  getChildHostContext(parentContext: unknown, type: string): unknown;
  /** 该类型+props 是否只渲染纯文本（DOM 实现：children 为 string/number 时提前建 text） */
  shouldSetTextContent(type: string, props: Props): boolean;
  createInstance(type: string, props: Props, rootContainer: unknown, hostContext: unknown): unknown;
  createTextInstance(text: string, rootContainer: unknown, hostContext: unknown): unknown;
  appendInitialChild(parentInstance: unknown, child: unknown): void;
  appendChild(parentInstance: unknown, child: unknown): void;
  appendChildToContainer(container: unknown, child: unknown): void;
  insertBefore(parentInstance: unknown, child: unknown, before: unknown): void;
  removeChild(parentInstance: unknown, child: unknown): void;
  removeChildFromContainer(container: unknown, child: unknown): void;
  commitUpdate(instance: unknown, oldProps: Props, newProps: Props, type: string): void;
  commitTextUpdate(textInstance: unknown, oldText: string, newText: string): void;
  getPublicInstance(instance: unknown): unknown;
}

let injectedHostConfig: HostConfig | null = null;

/** 注入 host 实现（只能一次；ReactDOM 与应用只能有一个版本） */
export function initializeHostConfig(hostConfig: HostConfig): void {
  if (__DEV__ && injectedHostConfig !== null) {
    throw new Error('HostConfig 已注入，不能重复初始化。');
  }
  injectedHostConfig = hostConfig;
}

function host(): HostConfig {
  if (injectedHostConfig === null) {
    throw new Error(
      '[react-reconciler] HostConfig 尚未注入：请先调用 initializeHostConfig()（react-dom 或 react-test-renderer 会做）。',
    );
  }
  return injectedHostConfig;
}

/**
 * reconciler 内部统一走这个代理对象调用 host 能力。
 * 学习点：把"创建/追加/插入/删除 DOM"这一族操作收敛到唯一入口，
 * 之后实现 beginWork/commit 时，代码里只出现 hostConfig.xxx()。
 */
export const hostConfig: HostConfig = {
  getRootHostContext: (rootContainer) => host().getRootHostContext(rootContainer),
  getChildHostContext: (parentContext, type) => host().getChildHostContext(parentContext, type),
  shouldSetTextContent: (type, props) => host().shouldSetTextContent(type, props),
  createInstance: (type, props, rootContainer, hostContext) =>
    host().createInstance(type, props, rootContainer, hostContext),
  createTextInstance: (text, rootContainer, hostContext) =>
    host().createTextInstance(text, rootContainer, hostContext),
  appendInitialChild: (parentInstance, child) => host().appendInitialChild(parentInstance, child),
  appendChild: (parentInstance, child) => host().appendChild(parentInstance, child),
  appendChildToContainer: (container, child) => host().appendChildToContainer(container, child),
  insertBefore: (parentInstance, child, before) =>
    host().insertBefore(parentInstance, child, before),
  removeChild: (parentInstance, child) => host().removeChild(parentInstance, child),
  removeChildFromContainer: (container, child) => host().removeChildFromContainer(container, child),
  commitUpdate: (instance, oldProps, newProps, type) =>
    host().commitUpdate(instance, oldProps, newProps, type),
  commitTextUpdate: (textInstance, oldText, newText) =>
    host().commitTextUpdate(textInstance, oldText, newText),
  getPublicInstance: (instance) => host().getPublicInstance(instance),
};
