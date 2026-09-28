// 对应官方 packages/react-reconciler/src/ReactFiberLane.new.js。
// Lane = 31 位位掩码：一个 bit 代表一条"优先级泳道"，越靠右（数值越小）优先级越高。
// 相比 React 15 的单一 expirationTime，Lane 的好处是：一次渲染可以同时承载多个优先级，
// 靠位运算就能合并、剔除、判断包含、取最高优先级。
import type { FiberRootNode } from './ReactFiberRoot';

export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = T[];

export const TotalLanes = 31;
export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;
export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;
export const InputContinuousHydrationLane: Lane = /*    */ 0b0000000000000000000000000000010;
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000000100;
export const DefaultHydrationLane: Lane = /*            */ 0b0000000000000000000000000001000;
export const DefaultLane: Lane = /*                     */ 0b0000000000000000000000000010000;
export const TransitionHydrationLane: Lane = /*         */ 0b0000000000000000000000000100000;
export const TransitionLane1: Lane = /*                 */ 0b0000000000000000000000001000000;
export const TransitionLane2: Lane = /*                 */ 0b0000000000000000000000010000000;
export const TransitionLane3: Lane = /*                 */ 0b0000000000000000000000100000000;
export const TransitionLane4: Lane = /*                 */ 0b0000000000000000000001000000000;
export const TransitionLane5: Lane = /*                 */ 0b0000000000000000000010000000000;
export const TransitionLane6: Lane = /*                 */ 0b0000000000000000000100000000000;
export const TransitionLane7: Lane = /*                 */ 0b0000000000000000001000000000000;
export const TransitionLane8: Lane = /*                 */ 0b0000000000000000010000000000000;
export const TransitionLane9: Lane = /*                 */ 0b0000000000000000100000000000000;
export const TransitionLane10: Lane = /*                */ 0b0000000000000001000000000000000;
export const TransitionLane11: Lane = /*                */ 0b0000000000000010000000000000000;
export const TransitionLane12: Lane = /*                */ 0b0000000000000100000000000000000;
export const TransitionLane13: Lane = /*                */ 0b0000000000001000000000000000000;
export const TransitionLane14: Lane = /*                */ 0b0000000000010000000000000000000;
export const TransitionLane15: Lane = /*                */ 0b0000000000100000000000000000000;
export const TransitionLane16: Lane = /*                */ 0b0000000001000000000000000000000;
export const TransitionLanes: Lanes = /*                */ 0b0000000001111111111111111000000;

export const RetryLane1: Lane = /*                      */ 0b0000000010000000000000000000000;
export const RetryLane2: Lane = /*                      */ 0b0000000100000000000000000000000;
export const RetryLane3: Lane = /*                      */ 0b0000001000000000000000000000000;
export const RetryLane4: Lane = /*                      */ 0b0000010000000000000000000000000;
export const RetryLane5: Lane = /*                      */ 0b0000100000000000000000000000000;
export const RetryLanes: Lanes = /*                     */ 0b0000111110000000000000000000000;

export const SomeRetryLane: Lane = RetryLane1;
export const SelectiveHydrationLane: Lane = /*          */ 0b0001000000000000000000000000000;
export const NonIdleLanes: Lanes = /*                   */ 0b0001111111111111111111111111111;

export const IdleHydrationLane: Lane = /*               */ 0b0010000000000000000000000000000;
export const IdleLane: Lane = /*                        */ 0b0100000000000000000000000000000;
export const OffscreenLane: Lane = /*                   */ 0b1000000000000000000000000000000;

export const NoTimestamp = -1;

export function createLaneMap<T>(initialValue: T): LaneMap<T> {
  return new Array(TotalLanes).fill(initialValue);
}

// ---- 位运算工具 ----
export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b;
}
export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset;
}
export function intersectLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a & b;
}
export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane): boolean {
  return (set & subset) === subset;
}
export function hasAnyLanes(set: Lanes, subset: Lanes | Lane): boolean {
  return (set & subset) !== NoLanes;
}
/** 官方命名（ReactFiberLane.new.js）：本仓库 hasAnyLanes 的别名，语义完全一致 */
export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane): boolean {
  return (a & b) !== NoLanes;
}
export function getHighestPriorityLane(lanes: Lanes | Lane): Lane {
  return lanes & -lanes; // 取出最低位的 1
}
export function includesSyncLane(lanes: Lanes): boolean {
  return (lanes & SyncLane) !== NoLanes;
}
export function includesNonIdleWork(lanes: Lanes): boolean {
  return (lanes & NonIdleLanes) !== NoLanes;
}
export function includesBlockingLane(lanes: Lanes): boolean {
  const SyncDefaultLanes =
    InputContinuousLane | InputContinuousHydrationLane | DefaultLane | DefaultHydrationLane;
  return (lanes & SyncDefaultLanes) !== NoLanes;
}

// ---- lane ↔ index ----
export function laneToIndex(lane: Lane): number {
  return pickArbitraryLaneIndex(lane);
}
export function pickArbitraryLane(lanes: Lanes): Lane {
  return getHighestPriorityLane(lanes);
}
/** 任意挑一个 set bit 的下标（clz32 取的是最高位；官方 pickArbitraryLaneIndex 即此语义） */
export function pickArbitraryLaneIndex(lanes: Lanes): number {
  return 31 - Math.clz32(lanes);
}

// ---- transition 泳道分配 ----
let currentUpdateTransitionLane = TransitionLane1;
export function isTransitionLane(lane: Lane): boolean {
  return (lane & TransitionLanes) !== NoLanes;
}
export function claimNextTransitionLane(): Lane {
  const lane = currentUpdateTransitionLane;
  currentUpdateTransitionLane =
    currentUpdateTransitionLane === TransitionLane16
      ? TransitionLane1
      : ((currentUpdateTransitionLane << 1) as Lane);
  return lane;
}

// ---- 优先级 → 超时（对应 lane 的过期时间，用于饥饿保护）----
function computeExpirationTime(lane: Lane, currentTime: number): number {
  if (hasAnyLanes(lane, SyncLane | InputContinuousHydrationLane | InputContinuousLane)) {
    return currentTime + 250;
  }
  if (
    hasAnyLanes(
      lane,
      DefaultHydrationLane | DefaultLane | TransitionHydrationLane | TransitionLanes,
    )
  ) {
    return currentTime + 5000;
  }
  // Retry / SelectiveHydration / IdleHydration / Idle / Offscreen：永不过期（不参与饥饿）
  return NoTimestamp;
}

/** 事件优先级本质就是 lane（官方 ReactEventPriorities 即 lane 位掩码），故这里直接返回 lane */
export function lanesToEventPriority(lanes: Lanes): Lane {
  const lane = getHighestPriorityLane(lanes);
  if (hasAnyLanes(lane, SyncLane)) return SyncLane;
  if (hasAnyLanes(lane, InputContinuousHydrationLane | InputContinuousLane)) {
    return InputContinuousLane;
  }
  if (hasAnyLanes(lane, DefaultHydrationLane | DefaultLane)) return DefaultLane;
  if (includesNonIdleWork(lane)) return DefaultLane; // transition / retry 等非 idle
  return IdleLane;
}

// ---- root 的 lane 记账 ----
export function markRootUpdated(root: FiberRootNode, lane: Lane, eventTime: number): void {
  root.pendingLanes |= lane;
  // 高优先级（非 idle）更新会打断挂起，清掉 suspended/pinged
  if (lane !== IdleLane) {
    root.suspendedLanes = NoLanes;
    root.pingedLanes = NoLanes;
  }
  const index = laneToIndex(lane);
  // eventTimes 无条件覆盖为最新（官方语义）；expirationTimes 不在此设，
  // 留给 markStarvedLanesAsExpired 用当前时间惰性计算（否则过期时钟锚定在首次更新时刻）。
  root.eventTimes[index] = eventTime;
}

export function markRootSuspended(root: FiberRootNode, suspendedLanes: Lanes): void {
  root.suspendedLanes |= suspendedLanes;
  root.pingedLanes &= ~suspendedLanes;
  // 挂起期间的 lane 不参与饥饿过期 → 清掉过期时间
  let lanes = suspendedLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    root.expirationTimes[index] = NoTimestamp;
    lanes &= ~lane;
  }
}

export function markRootFinished(root: FiberRootNode, remainingLanes: Lanes): void {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes;
  root.pendingLanes = remainingLanes;
  root.suspendedLanes = NoLanes;
  root.pingedLanes = NoLanes;
  root.expiredLanes &= remainingLanes;
  root.mutableReadLanes &= remainingLanes;
  root.entangledLanes &= remainingLanes;
  const entanglements = root.entanglements;
  const eventTimes = root.eventTimes;
  const expirationTimes = root.expirationTimes;
  let lanes = noLongerPendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    entanglements[index] = NoLanes;
    eventTimes[index] = NoTimestamp;
    expirationTimes[index] = NoTimestamp;
    lanes &= ~lane;
  }
}

export function markRootExpired(root: FiberRootNode, expiredLanes: Lanes): void {
  root.expiredLanes |= expiredLanes & root.pendingLanes;
}

export function markRootPinged(root: FiberRootNode, pingedLanes: Lanes): void {
  // 只有"挂起中"的 lane 被 ping 才记入 pingedLanes（官方语义）
  root.pingedLanes |= root.suspendedLanes & pingedLanes;
}

export function markRootEntangled(root: FiberRootNode, entangledLanes: Lanes): void {
  root.entangledLanes |= entangledLanes;
}

export function markRootMutableRead(root: FiberRootNode, mutableReadLanes: Lanes): void {
  root.mutableReadLanes |= mutableReadLanes & root.pendingLanes;
}

export function getLanesToRetrySynchronouslyOnError(root: FiberRootNode): Lanes {
  const everythingButOffscreen = root.pendingLanes & ~OffscreenLane;
  if (everythingButOffscreen !== NoLanes) {
    return everythingButOffscreen;
  }
  if (everythingButOffscreen & OffscreenLane) {
    return OffscreenLane;
  }
  return NoLanes;
}

export function markStarvedLanesAsExpired(root: FiberRootNode, currentTime: number): void {
  const pendingLanes = root.pendingLanes;
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;
  const expirationTimes = root.expirationTimes;
  let lanes = pendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    const expirationTime = expirationTimes[index];
    if (expirationTime === NoTimestamp) {
      // 尚无过期时间：非挂起、或已 ping 的 lane 应该设一个
      if ((lane & suspendedLanes) === NoLanes || (lane & pingedLanes) !== NoLanes) {
        expirationTimes[index] = computeExpirationTime(lane, currentTime);
      }
    } else if (expirationTime <= currentTime) {
      // 到期 → 标记过期（饥饿保护：低优先级也最终会跑）
      root.expiredLanes |= lane;
    }
    lanes &= ~lane;
  }
}

function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes {
  switch (getHighestPriorityLane(lanes)) {
    case SyncLane:
    case InputContinuousHydrationLane:
    case InputContinuousLane:
    case DefaultHydrationLane:
    case DefaultLane:
    case TransitionHydrationLane:
    case SelectiveHydrationLane:
    case IdleHydrationLane:
    case IdleLane:
    case OffscreenLane:
      return intersectLanes(lanes, getHighestPriorityLane(lanes));
    default:
      // 同一优先级档（transition / retry）的 pending lane 一起渲染（官方语义：合批）
      if ((lanes & TransitionLanes) !== NoLanes) {
        return lanes & TransitionLanes;
      }
      if ((lanes & RetryLanes) !== NoLanes) {
        return lanes & RetryLanes;
      }
      return lanes;
  }
}

/** 从 pendingLanes 挑出这次该渲染的 lane：非 idle 优先、排除 suspended、可用 pinged 兜底 */
export function getNextLanes(root: FiberRootNode, wipLanes: Lanes): Lanes {
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) {
    return NoLanes;
  }
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;

  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
  let nextLanes = NoLanes;
  if (nonIdlePendingLanes !== NoLanes) {
    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
    if (nonIdleUnblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
    } else {
      const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
      if (nonIdlePingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
      }
    }
  } else {
    const unblockedLanes = pendingLanes & ~suspendedLanes;
    if (unblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(unblockedLanes);
    } else if (pingedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(pingedLanes);
    }
  }

  if (nextLanes === NoLanes) {
    return NoLanes;
  }
  // 简化：当前两个调用点均传 wipLanes=NoLanes（单 lane、无并发打断）。
  // 官方的"新 lane 是否打断当前渲染"判定（含 suspended 守卫、default-vs-transition 特例、
  // entangled 展开）在第 16 章接入并发渲染时补齐。
  void wipLanes;
  return nextLanes;
}

export function includesExpiredLane(root: FiberRootNode, lanes: Lanes): boolean {
  return (lanes & root.expiredLanes) !== NoLanes;
}
