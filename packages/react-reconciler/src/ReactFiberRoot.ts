// 对应官方 packages/react-reconciler/src/ReactFiberRoot.old.js。
// FiberRoot 是整个应用"调度中枢"：它不参与渲染树，却记录着 pendingLanes / finishedWork 等
// 全局调度信息；它的 current 指向 HostRoot fiber（真正的树根）。
import { createHostRootFiber } from './ReactFiber';
import type { FiberNode } from './ReactFiber';
import { createLaneMap, NoLanes, NoLane, NoTimestamp } from './ReactFiberLane';
import type { LaneMap, Lanes, Lane } from './ReactFiberLane';

// 官方 ReactRootTags.js；React 18 用 ConcurrentRoot（legacy render 用 LegacyRoot）
export const LegacyRoot = 0;
export const ConcurrentRoot = 1;
export type RootTag = 0 | 1;

export class FiberRootNode {
  tag: RootTag;
  /** 渲染目标容器（DOM 下即 createRoot(container) 传进来的那个） */
  containerInfo: unknown;
  /** 已提交、正显示的 Fiber 树根（HostRoot fiber） */
  current: FiberNode;
  /** 有子节点待提交（第 4 章挂载后才有值） */
  pendingChildren: unknown = null;
  /** 一轮渲染结束产生的"成品树"，commit 前暂存（第 5 章） */
  finishedWork: FiberNode | null = null;
  /** 调度器回调句柄（第 14/16 章接入 Scheduler） */
  callbackNode: unknown = null;
  callbackPriority: Lane = NoLane;

  // ---- Lane 相关调度状态（第 15 章：getNextLanes / 饥饿过期）----
  pendingLanes: Lanes = NoLanes;
  suspendedLanes: Lanes = NoLanes;
  pingedLanes: Lanes = NoLanes;
  expiredLanes: Lanes = NoLanes;
  finishedLanes: Lanes = NoLanes;
  entangledLanes: Lanes = NoLanes;
  mutableReadLanes: Lanes = NoLanes;
  /** 每条 lane 最近一次更新的时间（官方 eventTimes） */
  eventTimes: LaneMap<number> = createLaneMap(NoTimestamp);
  /** 每条 lane 的过期时间（官方 expirationTimes，用于饥饿保护） */
  expirationTimes: LaneMap<number> = createLaneMap(NoTimestamp);
  /** 每条 lane 的纠缠关系（官方 entanglements；本系列无 Suspense，恒为 NoLanes） */
  entanglements: LaneMap<Lanes> = createLaneMap(NoLanes);

  constructor(containerInfo: unknown, tag: RootTag) {
    this.tag = tag;
    this.containerInfo = containerInfo;
    // root 的 current 永远先指向一个 HostRoot fiber（一颗空树）
    this.current = createHostRootFiber();
  }
}

/**
 * 创建 FiberRoot —— 官方 createFiberRoot。
 * 关键一步就在这里发生：`uninitializedFiber.stateNode = root`，
 * 双向引用让"从 fiber 找到 root"（调度时用）与"从 root 找到树"（渲染时用）都成立。
 */
export function createFiberRoot(containerInfo: unknown, tag: RootTag): FiberRootNode {
  const root = new FiberRootNode(containerInfo, tag);

  const uninitializedFiber = root.current;
  // FiberRoot.current 与 HostRoot fiber 的双向指认
  uninitializedFiber.stateNode = root;

  return root;
}
