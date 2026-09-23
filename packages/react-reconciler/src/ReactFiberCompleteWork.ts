// 对应官方 packages/react-reconciler/src/ReactFiberCompleteWork.old.js。
// completeWork 自底向上执行：孩子都 complete 之后轮到父亲，此时才创建/更新真实 host 实例。
// 挂载：createInstance；更新：prepareUpdate 算 props 差分 → 打 Update，commit 再用 payload 落 DOM。
import type { ReactContext } from '@mini-react/shared';
import { hostConfig } from './HostConfig';
import type { FiberNode } from './ReactFiber';
import { Update } from './ReactFiberFlags';
import type { Lanes } from './ReactFiberLane';
import { popProvider } from './ReactFiberNewContext';
import {
  ContextConsumer,
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
} from './ReactWorkTags';

/**
 * 挂载逻辑简写：从 wip.child 沿 sibling 把子实例都 append 到 parentInstance 上。
 * 组件层光纤要"下探"到第一个 host 节点（这就是为什么它叫 appendAllChildren）。
 */
function appendAllChildren(parentInstance: unknown, workInProgress: FiberNode): void {
  let node = workInProgress.child;
  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      // 用 appendInitialChild 而非 appendChild：前者是"挂载期串联 host 树"，
      // appendChild 留给 commit 阶段更新用（第 5 章），两者职责不混。
      hostConfig.appendInitialChild(parentInstance, node.stateNode);
    } else if (node.child !== null) {
      // 组件/fiber 包装层：跳到它的第一个孩子（其 stateNode 还没落到这里）
      node = node.child;
      continue;
    }
    if (node === workInProgress) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }
    node = node.sibling;
  }
}

/**
 * completeWork —— 官方同名函数的 mini 版（挂载 + 更新两态）。
 * 侧重点：HostComponent 复用 stateNode 后，用 prepareUpdate 求出 props 差分存入 updateQueue，
 * 有变化才打 Update flag —— commit 阶段据此决定要不要 commitUpdate。
 */
export function completeWork(
  current: FiberNode | null,
  workInProgress: FiberNode,
  _renderLanes: Lanes,
): null {
  const newProps = workInProgress.pendingProps;
  switch (workInProgress.tag) {
    case HostComponent: {
      const type = workInProgress.type as string;
      if (current === null || current.stateNode === null) {
        // 挂载：建实例 + 挂孩子
        const instance = hostConfig.createInstance(
          type,
          newProps as Record<string, unknown>,
          null,
          null,
        );
        appendAllChildren(instance, workInProgress);
        workInProgress.stateNode = instance;
      } else {
        // 更新：复用 current 的 stateNode，求 props 差分
        const oldProps = current.memoizedProps as Record<string, unknown>;
        const instance = workInProgress.stateNode;
        const updatePayload = hostConfig.prepareUpdate(
          instance,
          type,
          oldProps,
          newProps as Record<string, unknown>,
        );
        workInProgress.updateQueue = updatePayload;
        if (updatePayload !== null) {
          workInProgress.flags |= Update;
        }
      }
      return null;
    }
    case HostText: {
      if (current === null || current.stateNode === null) {
        workInProgress.stateNode = hostConfig.createTextInstance(String(newProps), null, null);
      } else {
        // 文本更新：内容变了才打 Update（官方只 markUpdate，commit 阶段直接读 memoizedProps）
        const oldText = current.memoizedProps as string;
        const newText = String(newProps);
        if (oldText !== newText) {
          workInProgress.flags |= Update;
        }
      }
      return null;
    }
    case ContextProvider: {
      // 出 Provider：把 context._currentValue 恢复到进入前的值（与 beginWork 的 push 配对）
      const context = (workInProgress.type as { _context: ReactContext<unknown> })._context;
      popProvider(context);
      return null;
    }
    case HostRoot:
    case ContextConsumer:
    case Fragment:
    case IndeterminateComponent:
    case FunctionComponent:
      return null;
    default:
      return null;
  }
}
