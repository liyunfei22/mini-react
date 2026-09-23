// 对应官方 packages/react-reconciler/src/ReactFiberCommitWork.old.js。
// commit 阶段把 render 阶段"描述好的改动"落到 host（DOM）。三阶段：
//   beforeMutation → mutation → `root.current = finishedWork` → layout
// 交换时机是本章的头号细节：mutation 用旧 current 做 DOM 增删改，改完才换指针，
// layout 阶段（refs/layout effects）读到的是新树。
import { hostConfig } from './HostConfig';
import type { FiberNode } from './ReactFiber';
import { MutationMask, Placement, Update } from './ReactFiberFlags';
import { NoLanes, removeLanes } from './ReactFiberLane';
import type { FiberRootNode } from './ReactFiberRoot';
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  IndeterminateComponent,
} from './ReactWorkTags';

export function commitRoot(root: FiberRootNode): void {
  commitRootImpl(root);
}

function commitRootImpl(root: FiberRootNode): void {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }
  const lanes = root.finishedLanes;
  root.finishedWork = null;
  root.finishedLanes = NoLanes;
  // 只清"本次渲染完成"的 lane（多 lane 并发时其余 lane 保留）；第 7 章单 lane 等价于清空
  root.pendingLanes = removeLanes(root.pendingLanes, lanes);

  // 阶段一 beforeMutation：类组件 getSnapshotBeforeUpdate / passive 卸载（第 9 章补实现）
  commitBeforeMutationEffects(root, finishedWork);

  // 阶段二 mutation：真正的 DOM 增删改（此时 root.current 仍是旧树）
  commitMutationEffects(root, finishedWork);

  // ---- 交换时机：mutation 之后、layout 之前 ----
  root.current = finishedWork;

  // 阶段三 layout：refs 挂载 / layout effects（第 9/12 章补实现）
  commitLayoutEffects(root, finishedWork);
}

// ---- 阶段一 / 阶段三：目前仅有结构，body 待后续章节填充 ----
function commitBeforeMutationEffects(_root: FiberRootNode, _finishedWork: FiberNode): void {
  // TODO(第9章)：递归跑 getSnapshotBeforeUpdate + 卸载惰性副作用
}

function commitLayoutEffects(_root: FiberRootNode, _finishedWork: FiberNode): void {
  // TODO(第9/12章)：attachRef + commitHookEffectListMount(Layout)
}

// ---- 阶段二：mutation ----
function commitMutationEffects(root: FiberRootNode, finishedWork: FiberNode): void {
  recursivelyTraverseMutationEffects(root, finishedWork);
}

function recursivelyTraverseMutationEffects(root: FiberRootNode, parentFiber: FiberNode): void {
  // ① 先处理"要删除"的旧节点（其 DOM 还挂在旧 current 上）
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    for (const childToDelete of deletions) {
      commitDeletionEffects(root, childToDelete);
    }
  }
  // ② 子树有 mutation 副作用才继续下探（subtreeFlags 剪枝，render 阶段已 bubbleProperties）
  if ((parentFiber.subtreeFlags & MutationMask) !== 0) {
    let child = parentFiber.child;
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root);
      child = child.sibling;
    }
  }
}

function commitMutationEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode): void {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case FunctionComponent:
    case IndeterminateComponent:
    case Fragment: {
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
      return;
    }
    case HostRoot: {
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
      return;
    }
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
      if ((flags & Update) !== 0) {
        const instance = finishedWork.stateNode;
        const current = finishedWork.alternate;
        // oldProps 取"上一次提交"的 current.memoizedProps；current 为空时兜底到自身
        const oldProps = (
          current !== null ? current.memoizedProps : finishedWork.memoizedProps
        ) as Record<string, unknown>;
        const newProps = finishedWork.memoizedProps as Record<string, unknown>;
        hostConfig.commitUpdate(
          instance,
          finishedWork.updateQueue,
          finishedWork.type as string,
          oldProps,
          newProps,
        );
      }
      return;
    }
    case HostText: {
      recursivelyTraverseMutationEffects(root, finishedWork);
      commitReconciliationEffects(finishedWork);
      if ((flags & Update) !== 0) {
        const current = finishedWork.alternate;
        // 官方：文本更新的新值直接读 finishedWork.memoizedProps（不占 updateQueue）
        const newText = finishedWork.memoizedProps as string;
        const oldText = (current !== null ? current.memoizedProps : newText) as string;
        hostConfig.commitTextUpdate(finishedWork.stateNode, oldText, newText);
      }
      return;
    }
    default:
      return;
  }
}

/** 处理 Placement / Deletion 这两类"结构型"副作用（官方 commitReconciliationEffects） */
function commitReconciliationEffects(finishedWork: FiberNode): void {
  const flags = finishedWork.flags;
  if ((flags & Placement) !== 0) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
}

/** 找到能"容下"这个节点真实 DOM 的父 fiber（上溯到最近的 HostComponent/HostRoot） */
function getHostParentFiber(fiber: FiberNode): FiberNode {
  let parent = fiber.return;
  while (parent !== null) {
    if (parent.tag === HostComponent || parent.tag === HostRoot) {
      return parent;
    }
    parent = parent.return;
  }
  throw new Error('[react-reconciler] 找不到 host parent');
}

/** 一路走到树顶 HostRoot，取出它的 stateNode（就是 FiberRootNode） */
function getRootFromHostRootFiber(fiber: FiberNode): FiberRootNode {
  let node = fiber;
  while (node.return !== null) {
    node = node.return;
  }
  return node.stateNode as FiberRootNode;
}

/** 取得"承载当前 DOM"的父级引用（container 或 host 实例） */
function getHostParent(fiber: FiberNode): { parent: unknown; isContainer: boolean } {
  const parentFiber = getHostParentFiber(fiber);
  const isContainer = parentFiber.tag === HostRoot;
  const parent = isContainer
    ? getRootFromHostRootFiber(parentFiber).containerInfo
    : parentFiber.stateNode;
  return { parent, isContainer };
}

/**
 * 找到"已提交的 host 兄弟节点"，作为插入位置（官方 getHostSibling）。
 * 从当前 fiber 沿 sibling 向后找——遇到 host 且没打 Placement 的就是"已经在 DOM 上的邻居"，
 * 新节点应插到它之前；否则（全是要插入的）返回 null，落回 append。
 */
function getHostSibling(fiber: FiberNode): unknown {
  let node: FiberNode = fiber;
  siblings: while (true) {
    while (node.sibling === null) {
      if (node.return === null) {
        return null;
      }
      if (isHostParent(node.return)) {
        return null; // 上溯到 host 边界仍无兄弟
      }
      node = node.return;
    }
    node.sibling.return = node.return; // 修正 return 指针（官方同款防御）
    node = node.sibling;
    // 跳到第一个 host 节点
    while (node.tag !== HostComponent && node.tag !== HostText) {
      if ((node.flags & Placement) !== 0) {
        continue siblings; // 这个兄弟也是待插入的，找下一个
      }
      if (node.child === null) {
        continue siblings;
      }
      node.child.return = node;
      node = node.child;
    }
    if ((node.flags & Placement) === 0) {
      return node.stateNode; // 已提交的 host 兄弟
    }
  }
}

function isHostParent(fiber: FiberNode): boolean {
  const tag = fiber.tag;
  return tag === HostComponent || tag === HostRoot || tag === HostPortal;
}

function commitPlacement(finishedWork: FiberNode): void {
  const { parent, isContainer } = getHostParent(finishedWork);
  // 移动/插中间时，before 指向"已提交的邻居"，insertBefore 据此落位；否则 append。
  const before = getHostSibling(finishedWork);
  insertOrAppendPlacementNode(finishedWork, before, parent, isContainer);
}

/** 删除一个旧 fiber 对应的真实 DOM（第 9 章补递归卸载副作用/清理 ref） */
function commitDeletionEffects(root: FiberRootNode, fiberToDelete: FiberNode): void {
  const tag = fiberToDelete.tag;
  if (tag === HostComponent || tag === HostText) {
    // host 节点：删它一个，其 DOM 子树就一起没了，绝不能再去递归删子节点（会重复 remove）
    const { parent, isContainer } = getHostParent(fiberToDelete);
    if (isContainer) {
      hostConfig.removeChildFromContainer(parent, fiberToDelete.stateNode);
    } else {
      hostConfig.removeChild(parent, fiberToDelete.stateNode);
    }
    return;
  }
  // 组件/wrapper 层节点：自身无 DOM，递归删除其 host 子孙
  let child = fiberToDelete.child;
  while (child !== null) {
    commitDeletionEffects(root, child);
    child = child.sibling;
  }
}

/**
 * 挂载/移动通用：待插入节点若是 host 直接插入；若是组件层则下探到它的每个 host 叶。
 * 挂载时整棵子树已由 completeWork 的 appendAllChildren 拼好，插根节点就够。
 */
function insertOrAppendPlacementNode(
  node: FiberNode,
  before: unknown,
  parent: unknown,
  isContainer: boolean,
): void {
  const isHost = node.tag === HostComponent || node.tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before != null) {
      hostConfig.insertBefore(parent, stateNode, before);
    } else if (isContainer) {
      hostConfig.appendChildToContainer(parent, stateNode);
    } else {
      hostConfig.appendChild(parent, stateNode);
    }
  } else {
    let child = node.child;
    while (child !== null) {
      insertOrAppendPlacementNode(child, before, parent, isContainer);
      child = child.sibling;
    }
  }
}
