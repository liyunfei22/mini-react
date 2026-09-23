// 对应官方 packages/react/src/ReactContext.js。
// createContext 只造一个"带当前值槽位"的对象：$$typeof 标识类型，
// _currentValue/_currentValue2 存当前值（渲染时由 Provider 的 pushProvider 改写），
// Provider 是个单独的包装对象，供 JSX 里 <Ctx.Provider value=...> 渲染。
import { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } from '@mini-react/shared';
import type { ReactContext } from '@mini-react/shared';

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    Provider: null as unknown as ReactContext<T>['Provider'],
    Consumer: null as unknown as ReactContext<T>,
  };
  // 循环引用：Provider 指回 context（reconciler 靠它从 Provider 元素找回 context）
  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };
  // prod 语义：Consumer 即 context 自身（官方非 DEV 分支即 context.Consumer = context）。
  // 注意：render-prop 的 <Ctx.Consumer>{v => ...}</Ctx.Consumer> 渲染路径在 mini 版未实现
  //（beginWork 会抛明确错误），只提供 Provider + useContext 两种用法。
  context.Consumer = context;
  return context;
}
