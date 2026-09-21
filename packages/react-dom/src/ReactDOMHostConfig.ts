// DOM 的 HostConfig 实现 —— 对应官方 packages/react-dom/src/client/ReactDOMHostConfig.js。
// 骨架阶段：只实现"一看就懂"的部分（上下文/纯文本判断），真实 DOM 操作（createInstance/
// commitUpdate/removeChild 等）留到第 4 章按 commit 流程逐个填充，当前抛 NotImplemented 防止误入。
import type { HostConfig, Props } from '@mini-react/react-reconciler';

function notImplemented(name: string): never {
  throw new Error(`[react-dom] ${name} 待第 4 章（首屏挂载）实现。`);
}

export const ReactDOMHostConfig: HostConfig = {
  // host context：DOM 下通常就是 document 的命名空间相关，简化为 null
  getRootHostContext: () => null,
  getChildHostContext: () => null,
  // 官方 isDirectTextChild：children 是 string|number 时不再建子 fiber，提前落文本
  shouldSetTextContent: (_type, props: Props) => {
    const children = props.children;
    return typeof children === 'string' || typeof children === 'number';
  },
  createInstance: (type, props) => notImplemented(`createInstance('${type}')`),
  createTextInstance: () => notImplemented('createTextInstance'),
  appendInitialChild: () => notImplemented('appendInitialChild'),
  appendChild: () => notImplemented('appendChild'),
  appendChildToContainer: () => notImplemented('appendChildToContainer'),
  insertBefore: () => notImplemented('insertBefore'),
  removeChild: () => notImplemented('removeChild'),
  removeChildFromContainer: () => notImplemented('removeChildFromContainer'),
  commitUpdate: () => notImplemented('commitUpdate'),
  commitTextUpdate: () => notImplemented('commitTextUpdate'),
  getPublicInstance: (instance) => instance,
};