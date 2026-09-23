// 对应官方 packages/react-reconciler/src/ReactHookEffectTags.js。
// effect 的"标签"有两个维度，用位编码：
//   HasEffect 位 —— 本轮要不要触发（deps 变化才置位）；
//   Insertion / Layout / Passive 位 —— 属于哪个提交阶段（分别是 useInsertionEffect / useLayoutEffect / useEffect）。
export type HookFlags = number;

export const NoFlags = /*   */ 0b0000;
/** 本轮是否需要触发（deps 变了才 `| HasEffect`） */
export const HasEffect = /* */ 0b0001;
/** useInsertionEffect 用（mini 版未实现） */
export const Insertion = /*  */ 0b0010;
/** useLayoutEffect：commit 阶段同步触发 */
export const Layout = /*    */ 0b0100;
/** useEffect：paint 后异步触发 */
export const Passive = /*   */ 0b1000;
