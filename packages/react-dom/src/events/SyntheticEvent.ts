// 对应官方 packages/react-dom/src/events/SyntheticEvent.js。
// 合成事件：把原生 Event 包一层，提供统一的 target/currentTarget、preventDefault、
// stopPropagation，以及"被阻止传播"的标记位（供根委托派发时在捕获/冒泡阶段提前停止）。
export interface SyntheticEvent {
  nativeEvent: Event;
  type: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  defaultPrevented: boolean;
  isPropagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export function createSyntheticEvent(nativeEvent: Event, eventType: string): SyntheticEvent {
  return {
    nativeEvent,
    type: eventType,
    target: nativeEvent.target,
    currentTarget: null,
    defaultPrevented: nativeEvent.defaultPrevented, // 继承原生已 preventDefault 的状态
    isPropagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
      nativeEvent.preventDefault();
    },
    stopPropagation() {
      // 关键：既要阻止原生冒泡，也要立一个标记让"合成事件路径上的后续 handler"不再执行
      this.isPropagationStopped = true;
      nativeEvent.stopPropagation();
    },
  };
}
