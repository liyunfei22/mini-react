// 对应官方 packages/react-reconciler/src/ReactWorkTags.js。
// Fiber 的 tag 字段标识"这个 fiber 节点是什么身份"，beginWork 靠它分发到不同的处理分支。
// 数字常量保持不变就是为了与官方对齐，便于逐行 diff。

export type WorkTag = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export const FunctionComponent = 0;
export const ClassComponent = 1;
export const IndeterminateComponent = 2; // 渲染后才知道是函数还是类组件
export const HostRoot = 3; // 树的根：FiberRoot.current 指向它
export const HostPortal = 4; // createPortal（mini 版未实现）
export const HostComponent = 5; // 真实 DOM 标签：'div' / 'span' ...
export const HostText = 6; // 文本节点
export const Fragment = 7;
export const Mode = 8; // <StrictMode>（mini 版未实现）
export const ContextConsumer = 9;
export const ContextProvider = 10;
export const ForwardRef = 11;
export const Profiler = 12; // mini 版未实现
export const SuspenseComponent = 13; // <Suspense>（第 19 章实现）
export const MemoComponent = 14;
export const SimpleMemoComponent = 15; // React.memo 且没有比较函数的快捷形态
export const LazyComponent = 16; // mini 版未实现
