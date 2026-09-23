// 对应官方 packages/react-dom/src/events/DOMPluginEventSystem.js + SimpleEventPlugin.js。
// 合成事件系统的核心：不在每个 DOM 节点绑事件，而是在根容器上绑一次、按事件类型委托。
// 关键：为"冒泡事件"同时挂捕获 + 冒泡两个监听，捕获 handler 在真实原生捕获阶段 dispatch；
// 对 scroll/load/error 这类不冒泡的事件只挂捕获监听去接住。
import type { Props } from '@mini-react/react-reconciler';
import { createSyntheticEvent } from './SyntheticEvent';
import type { SyntheticEvent } from './SyntheticEvent';

// ---- DOM 节点 → 当前 props（WeakMap 避免泄漏）----
const nodeToProps = new WeakMap<EventTarget, Props>();

export function trackNodeProps(node: EventTarget, props: Props): void {
  nodeToProps.set(node, props);
}

// ---- 事件优先级（对应官方的 Discrete/Continuous/Default 事件优先级，第 15 章映射到 Lane）----
export const DiscreteEventPriority = 0; // click / input …（映射到 SyncLane）
export const ContinuousEventPriority = 1; // mousemove / scroll …（映射到 InputContinuousLane）
export const DefaultEventPriority = 2; // load / error …

const DISCRETE_EVENTS = new Set([
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'keydown',
  'keyup',
  'keypress',
  'touchstart',
  'change',
  'submit',
  'input', // 官方把 input 归为 discrete
  'focusin',
  'focusout',
]);
const CONTINUOUS_EVENTS = new Set([
  'mousemove',
  'touchmove',
  'drag',
  'dragover',
  'dragstart',
  'wheel',
  'scroll',
]);

// focus/blur 不冒泡：用会冒泡的 focusin/focusout 合成 onFocus/onBlur
const NON_DELEGATED_EVENTS = new Set(['scroll', 'load', 'error']);

export function getEventPriority(eventType: string): number {
  if (DISCRETE_EVENTS.has(eventType)) return DiscreteEventPriority;
  if (CONTINUOUS_EVENTS.has(eventType)) return ContinuousEventPriority;
  return DefaultEventPriority;
}

let currentEventPriority: number = DefaultEventPriority;
export function getCurrentEventPriority(): number {
  return currentEventPriority;
}

/** 原生事件名 → React prop 键名（click→onClick、dblclick→onDoubleClick、focusin→onFocus…） */
function propKeyFromEvent(eventType: string): string {
  switch (eventType) {
    case 'dblclick':
      return 'onDoubleClick';
    case 'focusin':
      return 'onFocus';
    case 'focusout':
      return 'onBlur';
    case 'dragover':
      return 'onDragOver';
    case 'dragstart':
      return 'onDragStart';
    case 'dragenter':
      return 'onDragEnter';
    case 'dragleave':
      return 'onDragLeave';
    default:
      return 'on' + eventType.charAt(0).toUpperCase() + eventType.slice(1);
  }
}

const REGISTERED_EVENTS = [
  ...DISCRETE_EVENTS,
  ...CONTINUOUS_EVENTS,
  ...NON_DELEGATED_EVENTS,
];

const attachedRoots = new Set<EventTarget>();

export function attachRootListeners(rootElement: EventTarget): void {
  if (attachedRoots.has(rootElement)) return;
  attachedRoots.add(rootElement);
  for (const eventType of REGISTERED_EVENTS) {
    // 捕获监听：让 onXxxCapture 在真实原生捕获阶段 dispatch；也接住不冒泡的事件
    rootElement.addEventListener(eventType, (nativeEvent) => {
      dispatchEvent(eventType, nativeEvent, rootElement, 'capture');
    }, true);
    // 冒泡监听：普通冒泡事件在事件冒到根时 dispatch 冒泡阶段 handler
    if (!NON_DELEGATED_EVENTS.has(eventType)) {
      rootElement.addEventListener(eventType, (nativeEvent) => {
        dispatchEvent(eventType, nativeEvent, rootElement, 'bubble');
      }, false);
    }
  }
}

function dispatchEvent(
  eventType: string,
  nativeEvent: Event,
  rootElement: EventTarget,
  phase: 'capture' | 'bubble',
): void {
  // target→root 的 DOM 路径（含 root）
  const path: EventTarget[] = [];
  let node = nativeEvent.target as EventTarget | null;
  while (node !== null && node !== rootElement) {
    path.push(node);
    node = (node as Node).parentNode as EventTarget | null;
  }
  path.push(rootElement);

  const syntheticEvent: SyntheticEvent = createSyntheticEvent(nativeEvent, eventType);
  const prop = propKeyFromEvent(eventType) + (phase === 'capture' ? 'Capture' : '');

  const invoke = (target: EventTarget): void => {
    if (syntheticEvent.isPropagationStopped) return;
    const props = nodeToProps.get(target);
    const handler = props ? props[prop] : undefined;
    if (typeof handler === 'function') {
      syntheticEvent.currentTarget = target;
      try {
        handler(syntheticEvent);
      } finally {
        syntheticEvent.currentTarget = null; // 官方 executeDispatch 在每次 handler 后复位
      }
    }
  };

  const previousPriority = currentEventPriority;
  currentEventPriority = getEventPriority(eventType);
  try {
    if (phase === 'capture') {
      for (let i = path.length - 1; i >= 0; i--) {
        invoke(path[i]!);
        if (syntheticEvent.isPropagationStopped) break;
      }
    } else {
      for (let i = 0; i < path.length; i++) {
        invoke(path[i]!);
        if (syntheticEvent.isPropagationStopped) break;
      }
    }
  } finally {
    currentEventPriority = previousPriority;
  }
}