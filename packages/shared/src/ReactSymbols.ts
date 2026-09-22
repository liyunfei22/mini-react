// 对应官方 packages/shared/ReactSymbols.js。
// ReactElement 等类型标识放在 shared，是因为 react（产 element）与 react-reconciler（消费 element）
// 都要用同一个 symbol 判断对象身份，而后者绝不能 import react（保持 renderer 无关）。
//
// 用 Symbol.for 而不是 Symbol()：跨包、跨多份 react 副本都能命中同一个符号 ——
// 这也是为什么 even 手上装了两个不同版本的 react，element 仍能被正确识别。

export const REACT_ELEMENT_TYPE: symbol = Symbol.for('react.element');
export const REACT_FRAGMENT_TYPE: symbol = Symbol.for('react.fragment');
