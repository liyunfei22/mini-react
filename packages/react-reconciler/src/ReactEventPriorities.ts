// 对应官方 packages/react-reconciler/src/ReactEventPriorities.new.js。
// 官方模型里"事件优先级 == Lane"：getCurrentEventPriority 直接返回一条 lane，
// requestUpdateLane 据此择泳道。这里用官方数值（Discrete=SyncLane、Continuous=InputContinuousLane…
// ），与 ReactFiberLane 的 lanesToEventPriority 保持往返一致。
import { DefaultLane, IdleLane, InputContinuousLane, SyncLane } from './ReactFiberLane';

export const DiscreteEventPriority = SyncLane; // click / keydown
export const ContinuousEventPriority = InputContinuousLane; // mousemove / scroll
export const DefaultEventPriority = DefaultLane; // load / error
export const IdleEventPriority = IdleLane;

export const HigherEventPriority = DiscreteEventPriority;
export const LowerEventPriority = DefaultEventPriority;
