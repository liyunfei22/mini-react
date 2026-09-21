// @mini-react/shared —— 对应官方 packages/shared。
// 本包不面向最终用户：运行时被内联进各消费包（rollup external:[]），开发态由 alias 直连源码。

export {
  hasOwn,
  isArray,
  isFunction,
  isNumber,
  isObject,
  isPlainObject,
  isString,
  isSymbol,
  objectIs,
} from './is';

export { objectAssign } from './objectAssign';

// 总线单例（注册于 globalThis，全应用只此一份；reconciler 与 react 都从这拿）
export { ReactSharedInternals } from './ReactSharedInternals';

export type {
  DependencyList,
  Destructor,
  Dispatch,
  Dispatcher,
  EffectCallback,
  ReactContext,
  Reducer,
  SetStateAction,
  Transition,
} from './types';