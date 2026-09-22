// 对应官方 packages/react/src/ReactHooks.js。
// public hooks 本身没有任何实现——它们只是"读当前 dispatcher 再转发"的薄壳。
// 真正的实现来自 react-reconciler：渲染期间，renderWithHooks 把 mount/update 两个实现
// 写进 ReactSharedInternals.ReactCurrentDispatcher.current，本文件 resolveDispatcher 取出来调用。
// 这就是"react 包不至于 import reconciler、却能用上 hooks"的整个秘密（见 shared/ReactSharedInternals.ts）。
import { ReactSharedInternals } from '@mini-react/shared';
import type {
  DependencyList,
  Dispatch,
  Dispatcher,
  EffectCallback,
  ReactContext,
  Reducer,
  SetStateAction,
} from '@mini-react/shared';

function resolveDispatcher(): Dispatcher {
  const dispatcher = ReactSharedInternals.ReactCurrentDispatcher.current;
  if (dispatcher === null) {
    // 官方 invariant：「Invalid hook call. Hooks can only be called inside of the body
    // of a function component.」（在组件外调用 hook 时抛）
    throw new Error(
      'Invalid hook call. Hooks can only be called inside of the body of a function component.',
    );
  }
  return dispatcher;
}

export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  return resolveDispatcher().useState(initialState);
}

export function useReducer<S, A>(
  reducer: Reducer<S, A>,
  initialArg: S,
  init?: (arg: S) => S,
): [S, Dispatch<A>] {
  return resolveDispatcher().useReducer(reducer, initialArg, init);
}

export function useEffect(create: EffectCallback, deps?: DependencyList | null): void {
  return resolveDispatcher().useEffect(create, deps);
}

export function useLayoutEffect(create: EffectCallback, deps?: DependencyList | null): void {
  return resolveDispatcher().useLayoutEffect(create, deps);
}

export function useRef<T>(initialValue: T): { current: T } {
  return resolveDispatcher().useRef(initialValue);
}

export function useMemo<T>(create: () => T, deps?: DependencyList | null): T {
  return resolveDispatcher().useMemo(create, deps);
}

export function useCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  deps?: DependencyList | null,
): T {
  return resolveDispatcher().useCallback(callback, deps);
}

export function useContext<T>(context: ReactContext<T>): T {
  return resolveDispatcher().useContext(context);
}
