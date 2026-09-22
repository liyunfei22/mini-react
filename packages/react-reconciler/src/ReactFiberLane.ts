// 对应官方 packages/react-reconciler/src/ReactFiberLane.js。
// 第 15 章会补齐完整的 Lane 模型（31 位掩码、getNextLanes、SyncLane/TransitionLanes…）。
// 第 3 章 Fiber 结构里已经出现 lanes / childLanes 字段，所以这里先给最小定义占位：
// 类型 + "当前无事"的空值。数字即"位掩码"这一点先从概念上理解即可。

export type Lanes = number;
export type Lane = number;

export const TotalLanes = 31; // 官方用 31 条泳道（故意不用满 32，留符号位）

export const NoLanes: Lanes = 0b0000000000000000000000000000000;
export const NoLane: Lane = 0b0000000000000000000000000000000;
// 同步泳道：第 4 章 scheduleUpdateOnFiber 就要用（其余泳道/优先级表第 15 章补齐）
export const SyncLane: Lane = 0b0000000000000000000000000000001;

// 最小工具（第 15 章扩展整套位运算）
export function isSubsetOfLanes(set: Lanes, subset: Lanes): boolean {
  return (set & subset) === subset;
}

/** 取最高优先级的 lane = 最低位的 1 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes; // 位运算技巧：x & -x 取出最低位的 1
}
