// 跨包共享的纯类型。
// react 包（用户侧 API 的签名）与 react-reconciler（hooks 运行时实现）都引用这里，
// 避免双方互相 import —— 这是"shared 拆类型的价值"在代码上的体现。
// 各类型随章节逐步补齐（hooks 链表 / update 队列等类型在第 6 章加入）。

/** useState / useReducer 的 setter 签名 */
export type Dispatch<A> = (value: A) => void;

/** useState 的参数：直接值或惰性函数 */
export type SetStateAction<S> = S | ((prevState: S) => S);

/** reducer 签名 */
export type Reducer<S, A> = (prevState: S, action: A) => S;

/** 依赖数组（useEffect / useMemo / useCallback / useLayoutEffect） */
export type DependencyList = ReadonlyArray<unknown>;

/** effect 清理函数 */
export type Destructor = () => void;

/** useEffect 创建函数返回：void 或清理函数 */
export type EffectCallback = () => void | Destructor;

/** startTransition 的过渡对象（简化版，第 16 章补全） */
export interface Transition {
  name?: string;
}

/** Context 的跨包类型（第 11 章：Provider 引用 + 当前值） */
export interface ReactContext<T> {
  $$typeof: symbol;
  displayName?: string;
  // _currentValue2 仅为对齐官方（双渲染器槽位）；mini 单渲染器只用 _currentValue
  _currentValue: T;
  _currentValue2: T;
  Provider: {
    $$typeof: symbol;
    _context: ReactContext<T>;
  };
  // prod 语义下 Consumer 即 context 自身（render-prop 渲染路径 mini 版不支持，见 ReactContext.ts）
  Consumer: ReactContext<T>;
}

/**
 * Hooks 调度器接口：react-reconciler 在渲染期间把 mount/update 两份实现
 * 写入 ReactSharedInternals.ReactCurrentDispatcher.current（看 ReactCurrentDispatcher 机制）。
 * react 包的 public hooks 只认这个接口，不 care 具体实现。
 */
export interface Dispatcher {
  useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  useReducer<S, A>(reducer: Reducer<S, A>, initialArg: S, init?: (arg: S) => S): [S, Dispatch<A>];
  useEffect(create: EffectCallback, deps?: DependencyList | null): void;
  useLayoutEffect(create: EffectCallback, deps?: DependencyList | null): void;
  useRef<T>(initialValue: T): { current: T };
  useMemo<T>(create: () => T, deps?: DependencyList | null): T;
  useCallback<T extends (...args: never[]) => unknown>(
    callback: T,
    deps?: DependencyList | null,
  ): T;
  useContext<T>(context: ReactContext<T>): T;
  useTransition(): [boolean, (callback: () => void) => void];
  useDeferredValue<T>(value: T): T;
}
