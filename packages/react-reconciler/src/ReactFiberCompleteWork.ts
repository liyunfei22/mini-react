// 对应官方 packages/react-reconciler/src/ReactFiberCompleteWork.old.js。
// completeWork 自底向上执行：孩子都 complete 之后轮到父亲，此时才创建真实 host 实例
// （因为父实例需要先拿到子实例做 appendInitialChild）。
import { hostConfig } from './HostConfig';
import type { FiberNode } from './ReactFiber';
import type { Lanes } from './ReactFiberLane';
import {
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
  FunctionComponent,
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
 * completeWork —— 官方同名函数的 mini 版。
 * 只处理"建 host 实例"这一核心职责；props 更新（commitUpdate）第 5 章。
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
        const instance = hostConfig.createInstance(
          type,
          newProps as Record<string, unknown>,
          null,
          null,
        );
        // 孩子已完成，把它们的实例挂进这个刚建的父实例
        appendAllChildren(instance, workInProgress);
        workInProgress.stateNode = instance;
      }
      // 更新路径：prepareUpdate / commitUpdate（第 5 章）
      return null;
    }
    case HostText: {
      if (current === null || current.stateNode === null) {
        workInProgress.stateNode = hostConfig.createTextInstance(String(newProps), null, null);
      }
      return null;
    }
    case HostRoot:
    case IndeterminateComponent:
    case FunctionComponent:
      return null;
    default:
      return null;
  }
}
