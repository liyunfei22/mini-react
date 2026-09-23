// 对应官方 packages/react-reconciler/src/ReactFiberLane.js。
// 第 15 章会补齐完整的 Lane 模型（31 位掩码、getNextLanes、SyncLane/TransitionLanes…）。
// 第 3 章 Fiber 结构里已经出现 lanes / childLanes 字段，所以这里先给最小定义占位：
// 类型 + "当前无事"的空值。数字即"位掩码"这一点先从概念上理解即可。

export type Lanes = number;
export type Lane = number;

export const TotalLanes = 31; // 官方用 31 条泳道（故意不用满 32，留符号位）
export const NoTimestamp = -1;

export const NoLanes: Lanes = 0b0000000000000000000000000000000;
export const NoLane: Lane = 0b0000000000000000000000000000000;
// 同步泳道：第 4 章 scheduleUpdateOnFiber 就要用（其余泳道/优先级表第 15 章补齐）
export const SyncLane: Lane = 0b0000000000000000000000000000001;

// ---- 最小位运算工具（第 15 章扩展整套：过期/纠缠/饥饿重调度）----
export function isSubsetOfLanes(set: Lanes, subset: Lanes): boolean {
  return (set & subset) === subset;
}

/** 取最高优先级的 lane = 最低位的 1 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes; // 位运算技巧：x & -x 取出最低位的 1
}

export function mergeLanes(a: Lanes, b: Lanes): Lanes {
  return a | b;
}

export function removeLanes(set: Lanes, subset: Lanes): Lanes {
  return set & ~subset;
}

/** 是否包含同步泳道（discrete event 的优先级） */
export function includesSyncLane(lanes: Lanes): boolean {
  return (lanes & SyncLane) !== NoLanes;
}

/**
 * 从 root 的 pendingLanes 里挑出"这次该渲染的 lanes"。
 * 第 7 章：直接返回 pendingLanes（无事可跳过的场景）；第 15 章：排除 suspended、按优先级挑。
 */
export function getNextLanes(root: { pendingLanes: Lanes }): Lanes {
  return root.pendingLanes;
}
