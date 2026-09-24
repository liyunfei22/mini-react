// 对应官方 packages/scheduler/src/SchedulerMinHeap.js。
// 二进制最小堆：按 sortIndex（再按 id 保序）把 task/timer 排成"队头总是最高优先级"。
export interface HeapNode {
  id: number;
  sortIndex: number;
}

export type Heap = HeapNode[];

export function push(heap: Heap, node: HeapNode): void {
  const index = heap.length;
  heap.push(node);
  siftUp(heap, node, index);
}

export function peek(heap: Heap): HeapNode | null {
  return heap.length === 0 ? null : heap[0]!;
}

export function pop(heap: Heap): HeapNode | null {
  if (heap.length === 0) {
    return null;
  }
  const first = heap[0]!;
  const last = heap.pop()!;
  if (last !== first) {
    heap[0] = last;
    siftDown(heap, last, 0);
  }
  return first;
}

function siftUp(heap: Heap, node: HeapNode, i: number): void {
  let index = i;
  while (index > 0) {
    const parentIndex = (index - 1) >>> 1;
    const parent = heap[parentIndex]!;
    if (compare(parent, node) > 0) {
      heap[parentIndex] = node;
      heap[index] = parent;
      index = parentIndex;
    } else {
      return;
    }
  }
}

function siftDown(heap: Heap, node: HeapNode, i: number): void {
  let index = i;
  const length = heap.length;
  const halfLength = length >>> 1;
  while (index < halfLength) {
    const leftIndex = (index + 1) * 2 - 1;
    const left = heap[leftIndex]!;
    const rightIndex = leftIndex + 1;
    const right = heap[rightIndex];

    if (compare(left, node) < 0) {
      if (rightIndex < length && compare(right!, left) < 0) {
        heap[index] = right!;
        heap[rightIndex] = node;
        index = rightIndex;
      } else {
        heap[index] = left;
        heap[leftIndex] = node;
        index = leftIndex;
      }
    } else if (rightIndex < length && compare(right!, node) < 0) {
      heap[index] = right!;
      heap[rightIndex] = node;
      index = rightIndex;
    } else {
      return;
    }
  }
}

function compare(a: HeapNode, b: HeapNode): number {
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
