// 对应官方 packages/react-reconciler/src/ReactFiberNewContext.new.js。
// Context 读/写核心：Provider 用 pushProvider 把新值写进 context._currentValue 并压栈；
// 消费者用 readContext 读当前值，并把"我依赖了这个 context"记进 fiber.dependencies（链表）。
//
// 与官方的差异：官方用 valueCursor + 全局 valueStack；mini 用 providerStack 帧栈
//（每帧记 { context, 旧值 }），好处是渲染抛错时能靠 resetContextStack 一次性回收——
// 否则 provider 的 completeWork/pop 不执行，context._currentValue 会残留污染后续渲染。
import type { ReactContext } from '@mini-react/shared';
import type { FiberNode } from './ReactFiber';
import { NoLanes } from './ReactFiberLane';

interface ContextItem<T> {
  context: ReactContext<T>;
  memoizedValue: T;
  next: ContextItem<unknown> | null;
}

interface ProviderFrame {
  context: ReactContext<unknown>;
  prevValue: unknown;
}

// readContext 需要的"当前正在渲染，以及最近读到的 context 链"（与 ReactFiberHooks 的
// currentlyRenderingFiber 是两份独立的模块态，靠 renderWithHooks 里的 prepare/reset 同步）。
let currentlyRenderingFiber: FiberNode | null = null;
let lastContextDependency: ContextItem<unknown> | null = null;
let lastFullyObservedContext: ReactContext<unknown> | null = null;

// Provider 帧栈（见文件头）
const providerStack: ProviderFrame[] = [];

/** renderWithHooks 开头调用：重置本轮依赖收集 */
export function prepareToReadContext(workInProgress: FiberNode): void {
  currentlyRenderingFiber = workInProgress;
  lastContextDependency = null;
  lastFullyObservedContext = null;
  // 官方：in-place 复位上一轮依赖链表头（wip 与 current 共享同一 dependencies 对象）
  const deps = workInProgress.dependencies;
  if (deps !== null) {
    deps.firstContext = null;
  }
}

/** renderWithHooks 结尾调用：清空，防止组件外误读 context */
export function resetContextDependencies(): void {
  currentlyRenderingFiber = null;
  lastContextDependency = null;
  lastFullyObservedContext = null;
}

export function pushProvider<T>(
  _providerFiber: FiberNode,
  context: ReactContext<T>,
  nextValue: T,
): void {
  providerStack.push({
    context: context as ReactContext<unknown>,
    prevValue: context._currentValue,
  });
  context._currentValue = nextValue;
}

export function popProvider<T>(_context: ReactContext<T>): void {
  const frame = providerStack.pop();
  if (frame !== undefined) {
    (frame.context as ReactContext<T>)._currentValue = (frame as { prevValue: T }).prevValue;
  }
}

/** 渲染抛错时回收 Provider 栈，避免 context._currentValue 残留污染后续渲染（第 11 章复核发现） */
export function resetContextStack(): void {
  while (providerStack.length > 0) {
    const frame = providerStack.pop()!;
    frame.context._currentValue = frame.prevValue;
  }
}

export function readContext<T>(context: ReactContext<T>): T {
  const value = context._currentValue;

  if (lastFullyObservedContext === context) {
    // 同一组件内重复读同一个 context：去重，不再追加依赖项（官方同款短路）
    return value;
  }

  const contextItem: ContextItem<T> = { context, memoizedValue: value, next: null };
  if (lastContextDependency === null) {
    if (currentlyRenderingFiber === null) {
      throw new Error('Context can only be read while React is rendering the function body.');
    }
    lastContextDependency = contextItem as unknown as ContextItem<unknown>;
    currentlyRenderingFiber.dependencies = {
      lanes: NoLanes,
      firstContext: contextItem,
    };
  } else {
    lastContextDependency = lastContextDependency.next =
      contextItem as unknown as ContextItem<unknown>;
  }
  lastFullyObservedContext = context as ReactContext<unknown>;

  return value;
}
