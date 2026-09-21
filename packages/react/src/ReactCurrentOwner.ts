// 对应官方 react/src/ReactCurrentOwner.js。
// 记录"正在为谁创建 element"：用户在函数组件里写 JSX 时，createElement 会把
// ReactCurrentOwner.current 记进 element._owner，标识"这个 element 属于哪个组件"。
// 第 3 章（Fiber reconcile）会写入真实值；当前只要求可空。
export interface Owner {
  tag: number;
  type: unknown;
}

export const ReactCurrentOwner: { current: Owner | null } = {
  current: null,
};