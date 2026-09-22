// 对应官方 packages/react-reconciler/src/ReactFiberCommitWork.old.js。
// commit 阶段：把 render 阶段"描述好的改动"落到 host（DOM）上。
// 第 4 章只做 Mutation（Placement 插入）+ 双缓冲切换；三阶段（Before/Mutation/Layout）第 5 章展开。
import { hostConfig } from './HostConfig';
import type { FiberNode } from './ReactFiber';
import { Placement } from './ReactFiberFlags';
import { NoLanes } from './ReactFiberLane';
import type { FiberRootNode } from './ReactFiberRoot';
import { HostComponent, HostRoot, HostText } from './ReactWorkTags';

export function commitRoot(root: FiberRootNode): void {
  commitRootImpl(root);
}

function commitRootImpl(root: FiberRootNode): void {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }
  root.finishedWork = null;
  root.finishedLanes = NoLanes;
  root.pendingLanes = NoLanes;

  // 突变阶段：这里只有 Placement（挂载）
  commitMutationEffects(root, finishedWork);

  // 双缓冲切换：一行指针赋值，屏幕树从此变为成品树（before/layout 阶段的时序第 5 章细化）
  root.current = finishedWork;
}

function commitMutationEffects(root: FiberRootNode, finishedWork: FiberNode): void {
  recursivelyTraverseMutationEffects(root, finishedWork);
}

function recursivelyTraverseMutationEffects(root: FiberRootNode, parentFiber: FiberNode): void {
  let child = parentFiber.child;
  while (child !== null) {
    commitMutationEffectsOnFiber(child, root);
    child = child.sibling;
  }
}

function commitMutationEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode): void {
  // 先处理子树（子节点的 Placement 先落位），再处理自己
  recursivelyTraverseMutationEffects(root, finishedWork);

  if ((finishedWork.flags & Placement) !== 0) {
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

function commitPlacement(finishedWork: FiberNode): void {
  const parentFiber = getHostParentFiber(finishedWork);
  const isContainer = parentFiber.tag === HostRoot;
  const parent = isContainer
    ? getRootFromHostRootFiber(parentFiber).containerInfo
    : parentFiber.stateNode;

  insertOrAppendPlacementNode(finishedWork, null, parent, isContainer);
}

/**
 * 挂载时：待插入节点是"根底下带 Placement 的那一个"——它的整个子树都已由
 * completeWork 的 appendAllChildren 拼成一颗完整的 host 实例树，这里一次性挂进去即可。
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
    // 组件包装层：下探到它的 host 子节点，逐个插入到同一父级
    let child = node.child;
    while (child !== null) {
      insertOrAppendPlacementNode(child, before, parent, isContainer);
      child = child.sibling;
    }
  }
}
