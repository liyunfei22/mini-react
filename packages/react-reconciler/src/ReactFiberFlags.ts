// 对应官方 packages/react-reconciler/src/ReactFiberFlags.js。
// Fiber 的 flags / subtreeFlags 是"副作用标记"：render 期间记录哪些节点要增删改，
// commit 阶段再统一执行 DOM 操作。位标志（bitmask）让人能用 one number 表达 multiple 副作用。
//
// 两个易错点（本文件忠实于官方就是为了避免这两处踩坑）：
//   1. 数字必须与官方一一对应（与 ReactWorkTags 同理），方便逐行 diff；
//   2. "effect flag"（本轮要执行的副作用）与"static flag"（跨渲染保留）是两批不同的位，
//      混在一起会让 commit 阶段反复执行本已完成的副作用。

export type Flags = number;

export const NoFlags: Flags = /*                                 */ 0b00000000000000000000000000; // 0
export const PerformedWork: Flags = /*                           */ 0b00000000000000000000000001; // 1
export const Placement: Flags = /*                               */ 0b00000000000000000000000010; // 2  新增/移动
export const Update: Flags = /*                                  */ 0b00000000000000000000000100; // 4  更新 props/状态
export const PlacementAndUpdate: Flags = Placement | Update; //           6
export const Deletion: Flags = /*                                */ 0b00000000000000000000001000; // 8  删除自身
export const ChildDeletion: Flags = /*                           */ 0b00000000000000000000010000; // 16 删除子节点
export const ContentReset: Flags = /*                            */ 0b00000000000000000000100000; // 32
export const Callback: Flags = /*                                */ 0b00000000000000000001000000; // 64
export const DidCapture: Flags = /*                              */ 0b00000000000000000010000000; // 128
export const ForceClientRender: Flags = /*                       */ 0b00000000000000000100000000; // 256  SSR 相关（mini 版未用）
export const Ref: Flags = /*                                     */ 0b00000000000000001000000000; // 512
export const Snapshot: Flags = /*                                */ 0b00000000000000010000000000; // 1024
export const Passive: Flags = /*                                 */ 0b00000000000000100000000000; // 2048 useEffect
export const Hydrating: Flags = /*                               */ 0b00000000000001000000000000; // 4096 SSR 水合（mini 版未用）
export const Visibility: Flags = /*                              */ 0b00000000000010000000000000; // 8192 Offscreen（mini 版未用）
export const StoreConsistency: Flags = /*                        */ 0b00000000000100000000000000; // 16384 Suspense 快照（mini 版未用）
export const ShouldCapture: Flags = /*                          */ 0b00000000001000000000000000; // 32768 本轮挂起：渲染 fallback（第 19 章）

// ---- 阶段掩码：commit 各阶段只关心与自己相关的 flags ----
export const MutationMask: Flags =
  Placement | Update | ChildDeletion | ContentReset | Ref | Hydrating | Visibility;
export const LayoutMask: Flags = Update | Callback | Ref | Visibility;
export const PassiveMask: Flags = Passive | ChildDeletion;

// ---- 静态标记位：跨渲染保留"明确使用过的"hooks 信息，与上面的 effect flag 完全不重叠 ----
// 官方还有一处细节：这三个是高位独立位，绝不和 Update/Ref/ChildDeletion/Passive 混用，
// 否则 createWorkInProgress 的 `current.flags & StaticMask` 会把上一轮的副作用残留到下一轮。
export const LayoutStatic: Flags = /*                            */ 0b00001000000000000000000000;
export const RefStatic: Flags = /*                               */ 0b00010000000000000000000000;
export const PassiveStatic: Flags = /*                           */ 0b00100000000000000000000000;
export const StaticMask: Flags = LayoutStatic | PassiveStatic | RefStatic;
