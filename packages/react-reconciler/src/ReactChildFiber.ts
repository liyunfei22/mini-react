// 对应官方 packages/react-reconciler/src/ReactChildFiber.old.js。
// ChildReconciler 是"根据新 element 生成/复用子 fiber"的核心。关键机制：
//   shouldTrackSideEffects —— 内部转的是两个实例：
//     reconcileChildFibers(shouldTrackSideEffects=true)：更新路径，placeChild 要给新增/移动节点打 Placement；
//     mountChildFibers(shouldTrackSideEffects=false)：挂载路径，整棵子树都是新的，只要根节点打一次 Placement，
//       commit 时用 appendAllChildren 一次性把整棵子树挂进容器。
// 第 4 章实现挂载（mount）路径含正确打标；复用/删除（diff）第 8 章补齐。
import { REACT_ELEMENT_TYPE } from '@mini-react/shared';
import { createFiberFromElement, createFiberFromText, createWorkInProgress } from './ReactFiber';
import type { FiberNode } from './ReactFiber';
import { ChildDeletion, Placement } from './ReactFiberFlags';
import type { Lanes } from './ReactFiberLane';
import { HostText } from './ReactWorkTags';

type FiberElement = {
  $$typeof: symbol;
  type: unknown;
  key: null | string;
  props: Record<string, unknown>;
};

export function ChildReconciler(shouldTrackSideEffects: boolean) {
  /**
   * 给新 fiber 记位置，并按需打 Placement。
   * 返回值是"已放置的最后位置" lastPlacedIndex —— 调用方必须接住它（JS 参数按值传递，内部重赋值传不回）。
   *   - 不动（keep）：复用且位置没落后 → 返回旧 index；
   *   - 移动（move）：复用但旧位置 < lastPlacedIndex → 打 Placement，lastPlacedIndex 不变；
   *   - 插入（insert）：全新节点 → 打 Placement，lastPlacedIndex 不变。
   */
  function placeChild(newFiber: FiberNode, lastPlacedIndex: number, newIndex: number): number {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      // 挂载路径：不打标记（根节点统一负责）
      return lastPlacedIndex;
    }
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // 旧位置落后于已放置位置 → 需要移动
        newFiber.flags |= Placement;
        return lastPlacedIndex;
      }
      // 原地复用
      return oldIndex;
    }
    // 全新节点 → 插入
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }

  function createChild(
    returnFiber: FiberNode,
    newChild: unknown,
    mode: FiberNode['mode'],
    _lanes: Lanes,
  ): FiberNode | null {
    if ((typeof newChild === 'string' && newChild !== '') || typeof newChild === 'number') {
      const created = createFiberFromText(String(newChild), mode);
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === 'object' && newChild !== null) {
      const element = newChild as FiberElement;
      if (element.$$typeof === REACT_ELEMENT_TYPE) {
        const created = createFiberFromElement(element, mode);
        created.return = returnFiber;
        return created;
      }
    }

    // null / undefined / false / '' / 其它：不产生节点
    return null;
  }

  /** 复用旧 fiber（官方 useFiber：用 createWorkInProgress 造出它的 wip 版本，sibling 索引归零） */
  function useFiber(fiber: FiberNode, pendingProps: unknown): FiberNode {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  /** 把待删除的 current 子 fiber 记到父 fiber 的 deletions 列表（官方 deleteChild） */
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode): void {
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  /** 删除从某个起点开始的所有 current 兄弟 fiber（官方 deleteRemainingChildren） */
  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
  ): null {
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    element: FiberElement,
    _lanes: Lanes,
  ): FiberNode {
    const key = element.key;
    let child = currentFirstChild;
    while (child !== null) {
      // ① key 相同
      if (child.key === key) {
        const elementType = element.type;
        if (child.elementType === elementType) {
          // 类型也相同 → 复用：删掉其余兄弟，用旧 fiber 造 wip
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, element.props);
          existing.return = returnFiber;
          return existing;
        }
        // key 相同但类型不同（如 div → span）：旧节点及其兄弟全部作废，重建
        deleteRemainingChildren(returnFiber, child);
        break;
      }
      // ② key 不同：这个旧节点作废，继续找下一个
      deleteChild(returnFiber, child);
      child = child.sibling;
    }
    // ③ 找不到可复用的：全新创建
    const created = createFiberFromElement(element, returnFiber.mode);
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    textContent: string,
    _lanes: Lanes,
  ): FiberNode {
    // 官方语义：已有文本 fiber（且仍是 HostText）就复用，否则删旧建新
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = useFiber(currentFirstChild, textContent);
      existing.return = returnFiber;
      return existing;
    }
    deleteRemainingChildren(returnFiber, currentFirstChild);
    const created = createFiberFromText(textContent, returnFiber.mode);
    created.return = returnFiber;
    return created;
  }

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChildren: unknown[],
    lanes: Lanes,
  ): FiberNode | null {
    // 更新路径下，第 5 章还没做 key 复用/移动（第 8 章），先整段删除旧子，再造新的——
    // 否则旧 DOM 会残留、与新节点叠加重复。挂载路径（shouldTrackSideEffects=false）无需删。
    if (shouldTrackSideEffects) {
      deleteRemainingChildren(returnFiber, currentFirstChild);
    }

    let resultingFirstChild: FiberNode | null = null;
    let previousNewFiber: FiberNode | null = null;
    let lastPlacedIndex = 0;

    for (let newIndex = 0; newIndex < newChildren.length; newIndex++) {
      const newFiber = createChild(returnFiber, newChildren[newIndex], returnFiber.mode, lanes);
      if (newFiber === null) {
        continue;
      }
      // 接住返回值：lastPlacedIndex 必须在兄弟间正确传递（第 8 章 move 判定依赖它）
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
    return resultingFirstChild;
  }

  /** 给"单个新子节点"打 Placement（更新路径下它是新增的） */
  function placeSingleChild(newFiber: FiberNode): FiberNode {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement;
    }
    return newFiber;
  }

  function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: unknown,
    lanes: Lanes,
  ): FiberNode | null {
    if (typeof newChild === 'object' && newChild !== null) {
      const element = newChild as FiberElement;
      if (element.$$typeof === REACT_ELEMENT_TYPE) {
        return placeSingleChild(
          reconcileSingleElement(returnFiber, currentFirstChild, element, lanes),
        );
      }
    }

    if (Array.isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
    }

    if ((typeof newChild === 'string' && newChild !== '') || typeof newChild === 'number') {
      // 顶层文本/数字根也要打 Placement（官方此分支同样用 placeSingleChild 包裹）
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFirstChild, String(newChild), lanes),
      );
    }

    // null / undefined / false / ''：视为"没有子节点" → 删除所有既有子节点
    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }

  return reconcileChildFibers;
}

/** 更新路径：追踪副作用（给新增/移动节点打 Placement） */
export const reconcileChildFibers = ChildReconciler(true);
/** 挂载路径：不追踪副作用（省去打标开销，commit 一次性挂整棵子树） */
export const mountChildFibers = ChildReconciler(false);
