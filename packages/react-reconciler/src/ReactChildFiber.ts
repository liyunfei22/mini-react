// 对应官方 packages/react-reconciler/src/ReactChildFiber.old.js。
// ChildReconciler 是"根据新 element 生成/复用子 fiber"的核心。关键机制：
//   shouldTrackSideEffects —— 内部转的是两个实例：
//     reconcileChildFibers(shouldTrackSideEffects=true)：更新路径，placeChild 要给新增/移动节点打 Placement；
//     mountChildFibers(shouldTrackSideEffects=false)：挂载路径，整棵子树都是新的，只要根节点打一次 Placement，
//       commit 时用 appendAllChildren 一次性把整棵子树挂进容器。
// 第 4 章实现挂载（mount）路径含正确打标；复用/删除（diff）第 8 章补齐。
import { REACT_ELEMENT_TYPE } from '@mini-react/shared';
import { createFiberFromElement, createFiberFromText } from './ReactFiber';
import type { FiberNode } from './ReactFiber';
import { Placement } from './ReactFiberFlags';
import type { Lanes } from './ReactFiberLane';

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

  function reconcileSingleElement(
    returnFiber: FiberNode,
    _currentFirstChild: FiberNode | null,
    element: FiberElement,
    _lanes: Lanes,
  ): FiberNode {
    // 挂载路径（第 8 章补更新复用逻辑）
    const created = createFiberFromElement(element, returnFiber.mode);
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    _currentFirstChild: FiberNode | null,
    textContent: string,
    _lanes: Lanes,
  ): FiberNode {
    const created = createFiberFromText(textContent, returnFiber.mode);
    created.return = returnFiber;
    return created;
  }

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    _currentFirstChild: FiberNode | null,
    newChildren: unknown[],
    lanes: Lanes,
  ): FiberNode | null {
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

    // null / undefined / false / ''：删除既有子节点（更新语义，第 8 章做）
    return null;
  }

  return reconcileChildFibers;
}

/** 更新路径：追踪副作用（给新增/移动节点打 Placement） */
export const reconcileChildFibers = ChildReconciler(true);
/** 挂载路径：不追踪副作用（省去打标开销，commit 一次性挂整棵子树） */
export const mountChildFibers = ChildReconciler(false);
