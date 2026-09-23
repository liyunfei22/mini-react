// 对应官方 packages/react-reconciler/src/ReactFiberHooks.new.js。
// hooks 的两大机制都在这里：
//   1. ReactCurrentDispatcher 双实现切换：渲染前按"是初次挂载还是更新"把 mount/update 两份
//      dispatcher 写进总线，用户代码里的 useState 只是取总线上的实现来调；
//   2. hook 链表：每个 hook 记在 fiber.memoizedState 上、按调用顺序用 next 串成一条链表，
//      顺序恒定是它能"记住"每个 hook 状态的原因——这也解释了"为什么 hook 不能写在条件里"。
// （内部类型刻意用 unknown，避免泛型协变把 HookQueue 互相排斥；边界处按需断言。）
import { ReactSharedInternals, objectIs } from '@mini-react/shared';
import type { Dispatcher, Dispatch, Reducer, SetStateAction } from '@mini-react/shared';
import {
  LayoutStatic,
  Passive as PassiveFlag,
  PassiveStatic,
  Update as UpdateFlag,
} from './ReactFiberFlags';
import type { FiberNode } from './ReactFiber';
import type { FiberRootNode } from './ReactFiberRoot';
import {
  HasEffect as HookHasEffect,
  Layout as HookLayout,
  Passive as HookPassive,
} from './ReactHookEffectTags';
import { requestUpdateLane, scheduleUpdateOnFiber } from './ReactFiberWorkLoop';

// ---- 类型（非泛型，边界断言）----
interface Update {
  action: unknown;
  eagerReducer: unknown;
  eagerState: unknown;
  next: Update | null;
}
interface HookQueue {
  pending: Update | null;
  dispatch: Dispatch<unknown> | null;
  lastRenderedReducer: unknown;
  lastRenderedState: unknown;
}
interface Hook {
  memoizedState: unknown;
  baseState: unknown;
  baseQueue: Update | null;
  queue: HookQueue | null;
  next: Hook | null;
}

// ---- effect 相关类型（第 9 章）----
interface Effect {
  tag: number; // HasEffect | Layout/Passive
  create: () => void | (() => void);
  destroy: void | (() => void);
  deps: unknown[] | null;
  next: Effect | null;
}
interface FunctionComponentUpdateQueue {
  lastEffect: Effect | null;
}

// ---- 渲染上下文（模块级"正在渲染哪个 fiber / 走到哪个 hook"）----
let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

function basicStateReducer<S>(state: S, action: SetStateAction<S>): S {
  return typeof action === 'function' ? (action as (prev: S) => S)(state) : action;
}

/** 渲染函数组件（官方 renderWithHooks）—— beginWork 不再直接调 Component，而是经这里 */
export function renderWithHooks(
  current: FiberNode | null,
  workInProgress: FiberNode,
  Component: (props: unknown) => unknown,
  props: unknown,
): unknown {
  currentlyRenderingFiber = workInProgress;
  workInProgress.memoizedState = null;
  // updateQueue 也要清零：第 9 章 effect 链表挂这里，不复位会复用旧 effect 链
  workInProgress.updateQueue = null;
  workInProgressHook = null;
  currentHook = null;

  if (current !== null && current.memoizedState !== null) {
    ReactSharedInternals.ReactCurrentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    ReactSharedInternals.ReactCurrentDispatcher.current = HooksDispatcherOnMount;
  }

  let children: unknown;
  let didRenderTooFewHooks: boolean;
  try {
    children = Component(props);
    // 官方：渲染完 currentHook 应已走到 current 链尾；没走完 = 本轮少调了 hook（提前 return）
    // 用局部变量 + 断言，避免 TS 把模块级 currentHook 窄化成 null
    const ch = currentHook as Hook | null;
    didRenderTooFewHooks = ch !== null && ch.next !== null;
  } finally {
    // 组件抛异常也必须复位模块级状态（否则 dispatcher 残留、后续误调 hook 静默执行）
    currentlyRenderingFiber = null;
    workInProgressHook = null;
    currentHook = null;
    ReactSharedInternals.ReactCurrentDispatcher.current = null;
  }

  if (didRenderTooFewHooks) {
    throw new Error(
      'Rendered fewer hooks than expected. This may be caused by an accidental early return statement.',
    );
  }

  return children;
}

// ---- hook 链表 ----
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };
  if (workInProgressHook === null) {
    currentlyRenderingFiber!.memoizedState = workInProgressHook = hook;
  } else {
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
  let nextCurrentHook: Hook | null;
  if (currentHook === null) {
    const current = currentlyRenderingFiber!.alternate;
    nextCurrentHook = current !== null ? (current.memoizedState as Hook | null) : null;
  } else {
    nextCurrentHook = currentHook.next;
  }

  let nextWorkInProgressHook: Hook | null;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber!.memoizedState as Hook | null;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    workInProgressHook = nextWorkInProgressHook;
    currentHook = nextCurrentHook;
  } else {
    if (nextCurrentHook === null) {
      throw new Error('Rendered more hooks than during the previous render.');
    }
    currentHook = nextCurrentHook;
    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,
      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue, // ← 共享同一 queue 对象（dispatch 与 render 必须对到同一队）
      next: null,
    };
    if (workInProgressHook === null) {
      currentlyRenderingFiber!.memoizedState = workInProgressHook = newHook;
    } else {
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  return workInProgressHook;
}

// ---- 环形 pending 队列 ----
function enqueueUpdate(queue: HookQueue, action: unknown): void {
  const update: Update = { action, eagerReducer: null, eagerState: null, next: null };
  const pending = queue.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;
}

type ReducerFn<S> = (state: S, action: unknown) => S;

function processUpdateQueue<S>(hook: Hook, reducer: ReducerFn<S>): S {
  const queue = hook.queue as HookQueue;
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    const oldest = pendingQueue.next!;
    pendingQueue.next = null; // 断环成线
    if (hook.baseQueue === null) {
      hook.baseQueue = oldest;
    } else {
      let tail = hook.baseQueue;
      while (tail.next !== null) tail = tail.next;
      tail.next = oldest;
    }
    queue.pending = null;
  }

  let newState = hook.baseState as S;
  let update = hook.baseQueue;
  while (update !== null) {
    newState = reducer(newState, update.action);
    update = update.next;
  }

  hook.memoizedState = hook.baseState = newState;
  hook.baseQueue = null;
  queue.lastRenderedState = newState; // 供 dispatch 的 eager bailout 参考
  return newState;
}

// ---- mount / update dispatcher ----
function mountState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === 'function') {
    initialState = (initialState as () => S)();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue: HookQueue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;
  const fiber = currentlyRenderingFiber!;
  const dispatch = (queue.dispatch = dispatchSetState.bind(null, fiber, queue));
  return [hook.memoizedState as S, dispatch as Dispatch<SetStateAction<S>>];
}

function updateState<S>(_initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  return updateReducer(basicStateReducer, undefined as unknown as S) as [
    S,
    Dispatch<SetStateAction<S>>,
  ];
}

function mountReducer<S, A>(
  reducer: Reducer<S, A>,
  initialArg: S,
  init?: (arg: S) => S,
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = hook.baseState = init === undefined ? initialArg : init(initialArg);
  const queue: HookQueue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: hook.memoizedState,
  };
  hook.queue = queue;
  const fiber = currentlyRenderingFiber!;
  const dispatch = (queue.dispatch = dispatchReducerAction.bind(null, fiber, queue));
  return [hook.memoizedState as S, dispatch as Dispatch<A>];
}

function updateReducer<S, A>(
  reducer: Reducer<S, A>,
  _initialArg?: S,
  _init?: (arg: S) => S,
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue as HookQueue;
  queue.lastRenderedReducer = reducer;

  const newState = processUpdateQueue(hook, reducer as unknown as ReducerFn<S>);
  return [newState, queue.dispatch as Dispatch<A>];
}

// ---- dispatch ----
function dispatchReducerAction(fiber: FiberNode, queue: HookQueue, action: unknown): void {
  // 渲染期 dispatch（在组件 body 里调 setState）mini 版先抛错拒绝，而不是静默丢更新；
  // 官方会把它转成"再渲染一轮"并最终抛 Maximum update depth exceeded（后续章节再对齐）。
  if (fiber === currentlyRenderingFiber) {
    throw new Error(
      'Cannot update a component while rendering it (render-phase update). Please move the state update to an event handler or effect.',
    );
  }
  enqueueUpdate(queue, action);
  const root = getRootForUpdatedFiber(fiber);
  const lane = requestUpdateLane(fiber);
  scheduleUpdateOnFiber(root, fiber, lane);
}

function dispatchSetState<S>(fiber: FiberNode, queue: HookQueue, action: SetStateAction<S>): void {
  // eager bailout（官方 dispatchSetState 专属）：useState 的内置 reducer 是已知纯函数，
  // 队列为空时先试算 next state，Object.is 相同则直接从源头跳过调度（"设相同值不重渲染"）。
  const lastRenderedReducer = queue.lastRenderedReducer as ReducerFn<unknown> | null;
  if (lastRenderedReducer !== null && queue.pending === null) {
    let eagerState: unknown;
    try {
      eagerState = lastRenderedReducer(queue.lastRenderedState, action);
    } catch {
      eagerState = null; // eager 阶段异常吞掉，留到 render 阶段再抛（官方同款 try/catch 思路）
    }
    if (objectIs(eagerState, queue.lastRenderedState)) {
      return;
    }
  }
  dispatchReducerAction(fiber, queue, action as unknown);
}

function getRootForUpdatedFiber(fiber: FiberNode): FiberRootNode {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  return node.stateNode as FiberRootNode;
}

function notImplemented(name: string, chapter: string): never {
  throw new Error(`[react-reconciler] ${name} 尚未实现（第 ${chapter} 章）。`);
}

// ---- effect（第 9 章）----

/** 把新 effect 挂到当前 fiber.updateQueue 的环形链表末尾（官方 pushEffect） */
function pushEffect(
  tag: number,
  create: () => void | (() => void),
  destroy: void | (() => void),
  deps: unknown[] | null,
): Effect {
  const effect: Effect = { tag, create, destroy, deps, next: null };
  let componentUpdateQueue = currentlyRenderingFiber!
    .updateQueue as FunctionComponentUpdateQueue | null;
  if (componentUpdateQueue === null) {
    componentUpdateQueue = { lastEffect: null };
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue;
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next!;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }
  return effect;
}

/** deps 是否逐个 Object.is 相等（官方 areHookInputsEqual） */
function areHookInputsEqual(nextDeps: unknown[], prevDeps: unknown[] | null): boolean {
  if (prevDeps === null) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (objectIs(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function mountEffectImpl(
  fiberFlags: number,
  hookFlags: number,
  create: Effect['create'],
  deps: unknown[] | null,
): void {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber!.flags |= fiberFlags;
  hook.memoizedState = pushEffect(HookHasEffect | hookFlags, create, undefined, nextDeps);
}

function updateEffectImpl(
  fiberFlags: number,
  hookFlags: number,
  create: Effect['create'],
  deps: unknown[] | null,
): void {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: void | (() => void) = undefined;
  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect;
    destroy = prevEffect.destroy;
    if (nextDeps !== null) {
      if (areHookInputsEqual(nextDeps, prevEffect.deps)) {
        // deps 没变：带上旧 destroy（等真正变化/卸载再清理），不打 HasEffect → 本轮不触发
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps);
        return;
      }
    }
  }
  currentlyRenderingFiber!.flags |= fiberFlags;
  hook.memoizedState = pushEffect(HookHasEffect | hookFlags, create, destroy, nextDeps);
}

function mountEffect(create: Effect['create'], deps: unknown[] | null): void {
  return mountEffectImpl(PassiveFlag | PassiveStatic, HookPassive, create, deps);
}
function updateEffect(create: Effect['create'], deps: unknown[] | null): void {
  return updateEffectImpl(PassiveFlag, HookPassive, create, deps);
}
function mountLayoutEffect(create: Effect['create'], deps: unknown[] | null): void {
  return mountEffectImpl(UpdateFlag | LayoutStatic, HookLayout, create, deps);
}
function updateLayoutEffect(create: Effect['create'], deps: unknown[] | null): void {
  return updateEffectImpl(UpdateFlag, HookLayout, create, deps);
}

// ---- 记忆化三兄弟（第 10 章）：都只是"把值/fn/对象存到 hook.memoizedState"----
function mountMemo<T>(nextCreate: () => T, deps: unknown[] | undefined | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateMemo<T>(nextCreate: () => T, deps: unknown[] | undefined | null): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState as [T, unknown[] | null];
  if (nextDeps !== null && areHookInputsEqual(nextDeps, prevState[1])) {
    return prevState[0]; // deps 没变 → 复用旧值，不重算
  }
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function mountCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined | null,
): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function updateCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  deps: unknown[] | undefined | null,
): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState as [T, unknown[] | null];
  if (nextDeps !== null && areHookInputsEqual(nextDeps, prevState[1])) {
    return prevState[0]; // deps 没变 → 返回同一个引用，避免下游组件重渲染
  }
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}

function updateRef<T>(_initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState as { current: T };
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useReducer: mountReducer,
  useEffect: mountEffect,
  useLayoutEffect: mountLayoutEffect,
  useRef: mountRef,
  useMemo: mountMemo,
  useCallback: mountCallback,
  useContext: () => notImplemented('useContext', '11'),
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useReducer: updateReducer,
  useEffect: updateEffect,
  useLayoutEffect: updateLayoutEffect,
  useRef: updateRef,
  useMemo: updateMemo,
  useCallback: updateCallback,
  useContext: () => notImplemented('useContext', '11'),
};
