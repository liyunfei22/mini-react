// 对应官方 packages/react-reconciler/src/ReactChildFiber.old.js。
// ChildReconciler 是"根据新 element 生成/复用子 fiber"的核心。关键机制：
//   shouldTrackSideEffects —— 内部转的是两个实例：
//     reconcileChildFibers(shouldTrackSideEffects=true)：更新路径，placeChild 要给新增/移动节点打 Placement；
//     mountChildFibers(shouldTrackSideEffects=false)：挂载路径，整棵子树都是新的，只让根节点打 Placement。
// 数组 diff 是本章主体：key 相同 + type 相同 → 复用（useFiber）；key/type 变 → 删旧建新；
// 位置落后（oldIndex < lastPlacedIndex）→ 打 Placement 移动（commit 阶段用 insertBefore 落到正确位置）。
import { REACT_ELEMENT_TYPE } from '@mini-react/shared';
import { createFiberFromElement, createFiberFromText, createWorkInProgress } from './ReactFiber';
import type { FiberNode } from './ReactFiber';
import { ChildDeletion, Placement, Ref } from './ReactFiberFlags';
import type { Lanes } from './ReactFiberLane';
import { HostComponent, HostText } from './ReactWorkTags';

type FiberElement = {
  $$typeof: symbol;
  type: unknown;
  key: null | string;
  props: Record<string, unknown>;
  ref: unknown;
};

export function ChildReconciler(shouldTrackSideEffects: boolean) {
  /**
   * 给新 fiber 记位置，并按需打 Placement。返回值 lastPlacedIndex 必须被调用方接住。
   *   - 原地复用（keep）：复用且旧位置没落后 → 返回旧 index；
   *   - 移动（move）：复用但旧位置 < lastPlacedIndex → 打 Placement，lastPlacedIndex 不变；
   *   - 插入（insert）：全新节点 → 打 Placement，lastPlacedIndex 不变。
   */
  function placeChild(newFiber: FiberNode, lastPlacedIndex: number, newIndex: number): number {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex;
    }
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        newFiber.flags |= Placement; // move
        return lastPlacedIndex;
      }
      return oldIndex; // keep
    }
    newFiber.flags |= Placement; // insert
    return lastPlacedIndex;
  }

  function createChild(
    returnFiber: FiberNode,
    newChild: unknown,
    mode: FiberNode['mode'],
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
        markRef(created, element.ref);
        return created;
      }
    }
    return null;
  }

  /** 复用旧 fiber（官方 useFiber） */
  function useFiber(fiber: FiberNode, pendingProps: unknown): FiberNode {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  /** ref 有值就记到 fiber 上；只有 host 才打 Ref flag（commit 布局阶段据此 attachRef）。
   *  ForwardRef / 函数组件的 ref 会经 render(props, ref) 转发到内部 host，再在那一层 attach。 */
  function markRef(newFiber: FiberNode, ref: unknown): void {
    if (ref === undefined) {
      ref = null; // 未提供 ref 视为 null（官方 element 恒有 ref 字段，测试里手写 element 可能省略）
    }
    // coerceRef：只接受 function / object / null（字符串 ref 已废弃，DEV 下直接报错）
    if (__DEV__ && ref !== null && typeof ref !== 'function' && typeof ref !== 'object') {
      throw new Error('Element ref was specified as a non-object, non-function, non-null value.');
    }
    newFiber.ref = ref; // 无条件赋值（包含 null，保证"移除 ref"也被记录）
    if (newFiber.tag === HostComponent) {
      const current = newFiber.alternate;
      const changed =
        (current === null && ref !== null) || (current !== null && current.ref !== ref);
      if (changed) {
        newFiber.flags |= Ref;
      }
    }
  }

  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode): void {
    if (!shouldTrackSideEffects) {
      return; // 挂载路径（mountChildFibers）下删除是空操作（官方同款守卫）
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
  ): null {
    if (!shouldTrackSideEffects) {
      return null; // 挂载路径下无旧子可删（官方同款守卫）
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  // ---- 单节点复用/删除（第 5 章已有）----
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    element: FiberElement,
  ): FiberNode {
    const key = element.key;
    let child = currentFirstChild;
    while (child !== null) {
      if (child.key === key) {
        if (child.elementType === element.type) {
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, element.props);
          existing.return = returnFiber;
          markRef(existing, element.ref);
          return existing;
        }
        deleteRemainingChildren(returnFiber, child);
        break;
      }
      deleteChild(returnFiber, child);
      child = child.sibling;
    }
    const created = createFiberFromElement(element, returnFiber.mode);
    created.return = returnFiber;
    markRef(created, element.ref);
    return created;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    textContent: string,
  ): FiberNode {
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

  // ---- 数组 diff（第 8 章主体）----

  /** 按位置复用：slot 里 old 和 new 都对得上（key/type）就复用，否则返回 null */
  function updateSlot(
    returnFiber: FiberNode,
    oldFiber: FiberNode | null,
    newChild: unknown,
  ): FiberNode | null {
    const key = oldFiber !== null ? oldFiber.key : null;
    if (typeof newChild === 'object' && newChild !== null) {
      const element = newChild as FiberElement;
      if (element.$$typeof === REACT_ELEMENT_TYPE) {
        if (element.key === key) {
          return updateElement(returnFiber, oldFiber, element);
        }
        return null;
      }
    }
    if ((typeof newChild === 'string' && newChild !== '') || typeof newChild === 'number') {
      if (key === null) {
        return updateTextNode(returnFiber, oldFiber, String(newChild));
      }
      return null;
    }
    return null;
  }

  function updateElement(
    returnFiber: FiberNode,
    current: FiberNode | null,
    element: FiberElement,
  ): FiberNode {
    if (current !== null && current.elementType === element.type) {
      const existing = useFiber(current, element.props);
      existing.return = returnFiber;
      markRef(existing, element.ref);
      return existing;
    }
    const created = createFiberFromElement(element, returnFiber.mode);
    created.return = returnFiber;
    markRef(created, element.ref);
    return created;
  }

  function updateTextNode(
    returnFiber: FiberNode,
    current: FiberNode | null,
    textContent: string,
  ): FiberNode {
    if (current !== null && current.tag === HostText) {
      const existing = useFiber(current, textContent);
      existing.return = returnFiber;
      return existing;
    }
    const created = createFiberFromText(textContent, returnFiber.mode);
    created.return = returnFiber;
    return created;
  }

  /** 把剩下的 old fiber 建成 key/index → fiber 的映射（官方 mapRemainingChildren） */
  function mapRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode,
  ): Map<unknown, FiberNode> {
    const existingChildren = new Map<unknown, FiberNode>();
    let existingChild: FiberNode | null = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  function updateFromMap(
    existingChildren: Map<unknown, FiberNode>,
    returnFiber: FiberNode,
    newIdx: number,
    newChild: unknown,
  ): FiberNode | null {
    if ((typeof newChild === 'string' && newChild !== '') || typeof newChild === 'number') {
      const matchedFiber = existingChildren.get(newIdx) ?? null;
      return updateTextNode(returnFiber, matchedFiber, String(newChild));
    }
    if (typeof newChild === 'object' && newChild !== null) {
      const element = newChild as FiberElement;
      if (element.$$typeof === REACT_ELEMENT_TYPE) {
        const matchedFiber =
          existingChildren.get(element.key === null ? newIdx : element.key) ?? null;
        return updateElement(returnFiber, matchedFiber, element);
      }
    }
    return null;
  }

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChildren: unknown[],
  ): FiberNode | null {
    let resultingFirstChild: FiberNode | null = null;
    let previousNewFiber: FiberNode | null = null;

    let oldFiber: FiberNode | null = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber: FiberNode | null;

    // 第一趟：按位置 matching（O(n) 处理"同位置复用"）
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      if (oldFiber.index > newIdx) {
        // 有 key 且乱序：跳过这个 old，交给第二趟 map 阶段
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx]);
      if (newFiber === null) {
        // 关键：第一个"同位置匹配失败"就 break（而不是 continue）——后续交给 map 阶段
        // 按 key 匹配；因为 keyed 列表一旦在某个位置对不上，后面的位置匹配就都不可信了。
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }
      if (shouldTrackSideEffects) {
        if (oldFiber !== null && newFiber.alternate === null) {
          // 位置上那个 old 没被复用（key/type 不符）→ 删除
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    // new 处理完了：删掉剩余 old
    if (newIdx === newChildren.length) {
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    // old 处理完了：剩余 new 全是新增
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx], returnFiber.mode);
        if (newFiber === null) continue;
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      return resultingFirstChild;
    }

    // 有 key 的乱序/移动：第二趟用 map 匹配
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(existingChildren, returnFiber, newIdx, newChildren[newIdx]);
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            // 复用成功：从 map 里摘掉（防止同 key 被二次复用/漏删）
            existingChildren.delete(newFiber.key === null ? newIdx : newFiber.key);
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    // map 里剩下的 = 本轮没被匹配上的旧节点 → 全部删除
    if (shouldTrackSideEffects) {
      existingChildren.forEach((child) => deleteChild(returnFiber, child));
    }
    return resultingFirstChild;
  }

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
    _lanes: Lanes,
  ): FiberNode | null {
    if (typeof newChild === 'object' && newChild !== null) {
      const element = newChild as FiberElement;
      if (element.$$typeof === REACT_ELEMENT_TYPE) {
        return placeSingleChild(reconcileSingleElement(returnFiber, currentFirstChild, element));
      }
    }

    if (Array.isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild);
    }

    if ((typeof newChild === 'string' && newChild !== '') || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFirstChild, String(newChild)),
      );
    }

    // null / undefined / false / ''：视为无子节点
    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }

  return reconcileChildFibers;
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);

/**
 * 克隆整条 child 链（官方 ReactChildFiber.new.js `cloneChildFibers`）。
 * bailout 的续行手段：本 fiber 自身没有要渲染的活，但子树里有——
 * 就把 current 的孩子逐个 createWorkInProgress 成 wip（pendingProps 原样带过去，
 * 于是它们的 beginWork 会命中"props 没变"分支、继续各自判断该不该往下钻）。
 */
export function cloneChildFibers(current: FiberNode | null, workInProgress: FiberNode): void {
  if (current !== null && workInProgress.child !== current.child) {
    // 官方此处是「断点续渲染」的守卫；mini 版无断点续渲染，保留同款投错以示约束
    throw new Error('Resuming work not yet implemented.');
  }
  if (workInProgress.child === null) {
    return;
  }
  let currentChild = workInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;
  newChild.return = workInProgress;
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps);
    newChild.return = workInProgress;
  }
  newChild.sibling = null;
}
