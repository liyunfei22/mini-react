// 对应官方 packages/react/src/ReactElement.js + ReactElementValidator.js（我们只保留核心校验）。
//
// 学习要点（本文件是全系列的起点）：
// 1. ReactElement 不是"虚拟 DOM"，是一个纯描述对象，靠 $$typeof = Symbol.for('react.element') 标识；
// 2. key / ref 是"元数据"，从 config 里剥离，绝不进 props；
// 3. children "单个不包数组、多个成数组" —— 这是 React 稳定契约，渲染时才好处理。
import { hasOwn } from '@mini-react/shared';
import { ReactCurrentOwner } from './ReactCurrentOwner';

// ---- 类型标识（Symbol.for 保证跨包/跨模块单例）----
export const REACT_ELEMENT_TYPE: symbol = Symbol.for('react.element');
export const REACT_FRAGMENT_TYPE: symbol = Symbol.for('react.fragment');

// ---- 公开类型 ----
export type ReactKey = string | null;

export type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactNode[];

/** props 的默认形状：允许任意属性名 + 保留 children 位 */
export type ElementProps = {
  [propName: string]: unknown;
  children?: ReactNode;
};

export interface ReactElement<Type = unknown, Props extends object = ElementProps> {
  $$typeof: symbol;
  type: Type;
  key: ReactKey;
  ref: unknown;
  props: Props;
  _owner: unknown;
  _store: { validated: boolean };
  /** dev 专用：当前组件自引用 */
  _self?: unknown;
  /** dev 专用：JSX 编译时源码位置 */
  _source?: unknown;
}

/** createElement / jsx 的 config 形状 */
export interface ElementConfig {
  key?: ReactKey;
  ref?: unknown;
  __self?: unknown;
  __source?: unknown;
  [propName: string]: unknown;
}

// 这些属性从 config 里"抽出来"，不进 props
const RESERVED_PROPS: Record<string, boolean> = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
};

function hasValidKey(config: ElementConfig): boolean {
  return config.key !== undefined;
}

function hasValidRef(config: ElementConfig): boolean {
  return config.ref !== undefined;
}

/** dev 下校验 type：只允许内置标签(string)/函数/符号(如 Fragment) */
export function validateElementType(type: unknown, _source: string | null): void {
  if (typeof type === 'function' || typeof type === 'string' || typeof type === 'symbol') {
    return;
  }
  // 对应官方 invariant：'Element type is invalid: expected a string (for built-in
  // components) or a class/function (for composite components) but got: %s'
  throw new Error(
    `Element type is invalid: expected a string (for built-in components) or a ` +
      `class/function (for composite components) but got: ${Object.prototype.toString.call(type)}.`,
  );
}

/**
 * ReactElement 工厂 —— 官方同名函数。
 * 注意：所有真实 DOM / 组件渲染逻辑都在 react-reconciler（第 4 章起），
 * 这里只负责"造一个分布式的描述对象"。
 */
export function ReactElement<Type = unknown>(
  type: Type,
  key: ReactKey,
  ref: unknown,
  self: unknown,
  source: unknown,
  owner: unknown,
  props: Record<string, unknown>,
): ReactElement<Type> {
  const element: ReactElement<Type> = {
    // 标记对象是 React Element，允许跨库协作时（如渲染器）用同一个 symbol 识别
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    _owner: owner,
    _store: { validated: false },
  };

  if (__DEV__) {
    // dev 独有、不可枚举的 _self / _source，供报错时定位组件
    Object.defineProperty(element, '_self', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: self,
    });
    Object.defineProperty(element, '_source', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: source,
    });
  }

  return element;
}

/**
 * createElement —— 对应官方 && React.createElement。
 * 经典模式三参起：createElement(type, config, ...children)。
 */
export function createElement<Type>(
  type: Type,
  config?: ElementConfig | null,
  ...children: unknown[]
): ReactElement<Type> {
  if (__DEV__) {
    // 官方用 _owner 区分顶层变量级校验；学习版简化为直接校验 type
    validateElementType(type, null);
  }

  let propName: string;
  const props: Record<string, unknown> = {};
  let key: ReactKey = null;
  let ref: unknown = null;

  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref;
    }
    if (hasValidKey(config)) {
      key = '' + (config.key as ReactKey);
    }
    for (propName in config) {
      if (hasOwn(config, propName) && !hasOwn(RESERVED_PROPS, propName)) {
        props[propName] = config[propName];
      }
    }
  }

  const childrenLength = children.length;
  if (childrenLength === 1) {
    // 单个 children 不包数组 —— React 稳定契约
    props.children = children[0];
  } else if (childrenLength > 1) {
    const childArray = new Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = children[i];
    }
    props.children = childArray;
  }

  if (type !== null && (type as { defaultProps?: unknown }).defaultProps !== undefined) {
    const defaultProps = (type as { defaultProps: Record<string, unknown> }).defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }

  const owner = ReactCurrentOwner.current;
  return ReactElement(type, key, ref, undefined, undefined, owner, props);
}

/**
 * isValidElement —— 判断对象是不是 ReactElement。
 * 官方实现：typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE
 */
export function isValidElement(object: unknown): object is ReactElement {
  return (
    typeof object === 'object' &&
    object !== null &&
    (object as { $$typeof?: unknown }).$$typeof === REACT_ELEMENT_TYPE
  );
}

// Fragment：JSX 里 <>...</> 编译到的符号，也是普通组件可以做 children 分组的标记
export const Fragment: symbol = REACT_FRAGMENT_TYPE;
