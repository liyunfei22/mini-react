import { describe, expect, it } from 'vitest';
import {
  DefaultLane,
  IdleLane,
  SyncLane,
  TransitionLanes,
  claimNextTransitionLane,
  createContainer,
  getHighestPriorityLane,
  getNextLanes,
  hasAnyLanes,
  includesSyncLane,
  intersectLanes,
  isSubsetOfLanes,
  isTransitionLane,
  laneToIndex,
  markRootUpdated,
  markStarvedLanesAsExpired,
  mergeLanes,
  NoLanes,
  removeLanes,
} from '../index';

describe('Lane 位运算', () => {
  it('mergeLanes / intersectLanes / removeLanes', () => {
    expect(mergeLanes(0b0010, 0b0100)).toBe(0b0110);
    expect(intersectLanes(0b0111, 0b0101)).toBe(0b0101);
    expect(removeLanes(0b0111, 0b0010)).toBe(0b0101);
  });

  it('isSubsetOfLanes / hasAnyLanes', () => {
    expect(isSubsetOfLanes(0b111, 0b010)).toBe(true);
    expect(isSubsetOfLanes(0b010, 0b111)).toBe(false);
    expect(hasAnyLanes(0b101, 0b011)).toBe(true);
    expect(hasAnyLanes(0b100, 0b011)).toBe(false);
  });

  it('getHighestPriorityLane 取最低位的 1', () => {
    expect(getHighestPriorityLane(0b10100)).toBe(0b100);
  });

  it('泳道常量位值', () => {
    expect(SyncLane).toBe(1 << 0);
    expect(DefaultLane).toBe(1 << 4);
    expect(IdleLane).toBe(1 << 29);
    expect(includesSyncLane(SyncLane | DefaultLane)).toBe(true);
    expect(includesSyncLane(DefaultLane)).toBe(false);
  });

  it('isTransitionLane 与 claimNextTransitionLane 轮转', () => {
    const l1 = claimNextTransitionLane();
    const l2 = claimNextTransitionLane();
    expect(isTransitionLane(l1)).toBe(true);
    expect(isTransitionLane(l2)).toBe(true);
    expect(TransitionLanes & (l1 | l2)).toBe(l1 | l2);
    expect(l1).not.toBe(l2);
  });
});

describe('root 的 lane 记账', () => {
  it('getNextLanes 排除 suspended，选未挂起的最高优先级', () => {
    const root = createContainer({});
    root.pendingLanes = SyncLane | DefaultLane;
    root.suspendedLanes = SyncLane; // sync 被挂起
    expect(getNextLanes(root, NoLanes)).toBe(DefaultLane);
  });

  it('getNextLanes 非 idle 优先于 idle', () => {
    const root = createContainer({});
    root.pendingLanes = IdleLane | SyncLane;
    expect(getNextLanes(root, NoLanes)).toBe(SyncLane);
  });

  it('markRootUpdated 记录 eventTime', () => {
    const root = createContainer({});
    markRootUpdated(root, DefaultLane, 42);
    expect(root.eventTimes[laneToIndex(DefaultLane)]).toBe(42);
  });

  it('markStarvedLanesAsExpired：过期时间已过则标记 expiredLanes', () => {
    const root = createContainer({});
    root.pendingLanes = DefaultLane;
    root.expirationTimes[laneToIndex(DefaultLane)] = 500; // 直接给一个已过的过期时间
    markStarvedLanesAsExpired(root, 1000);
    expect(root.expiredLanes & DefaultLane).toBe(DefaultLane);
  });

  it('markStarvedLanesAsExpired：过期时间懒计算，未到点不标记', () => {
    const root = createContainer({});
    root.pendingLanes = DefaultLane;
    markStarvedLanesAsExpired(root, 1000); // 懒设 exp = 1000 + 5000 = 6000，未过期
    expect(root.expiredLanes & DefaultLane).toBe(NoLanes);

    markStarvedLanesAsExpired(root, 7000); // 推进到过期之后
    expect(root.expiredLanes & DefaultLane).toBe(DefaultLane);
  });
});
