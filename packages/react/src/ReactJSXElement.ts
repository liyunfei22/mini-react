// 对应官方 packages/react/src/jsx/ReactJSXElement.js。
// 自动运行时（Babel automatic / esbuild / swc）直接调用本文件的 jsx / jsxs；dev 构建调用 jsxDEV。
//
// 与 createElement 的区别：
// - key 由第三个参数单独传入（maybeKey），而不是 config.key —— 这是自动运行时的编译器约定；
// - 不再接受 config 里的 __self / __source（那是 DEV 工具渲染路径）。
import { hasOwn } from '@mini-react/shared';
import { ReactCurrentOwner } from './ReactCurrentOwner';
import { ReactElement as elementFactory, validateElementType } from './ReactElement';
import type { ElementConfig, ReactElement, ReactKey } from './ReactElement';

const RESERVED_PROPS: Record<string, boolean> = {
  key: true,
  ref: true,
};

function hasValidRef(config: ElementConfig): boolean {
  return config.ref !== undefined;
}

function defaultPropsFill(props: Record<string, unknown>, type: unknown): Record<string, unknown> {
  if (type !== null && (type as { defaultProps?: unknown }).defaultProps !== undefined) {
    const defaultProps = (type as { defaultProps: Record<string, unknown> }).defaultProps;
    for (const propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  return props;
}

function jsxCommon<Type = unknown>(
  type: Type,
  config: ElementConfig | null,
  maybeKey: ReactKey | undefined,
  children: readonly unknown[],
  source?: unknown,
  self?: unknown,
): ReactElement<Type> {
  let propName: string;
  const props: Record<string, unknown> = {};
  let key: ReactKey = null;
  let ref: unknown = null;

  if (maybeKey !== undefined) {
    key = '' + maybeKey;
  }
  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref;
    }
    for (propName in config) {
      if (hasOwn(config, propName) && !hasOwn(RESERVED_PROPS, propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // children：自动运行时会放进 config.children（jsxs 保证是数组）；手写调用也允许 rest 传入
  const childrenLength = children.length;
  if (childrenLength === 1) {
    props.children = children[0];
  } else if (childrenLength > 1) {
    const childArray = new Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = children[i];
    }
    props.children = childArray;
  }

  defaultPropsFill(props, type);

  const owner = ReactCurrentOwner.current;
  // self/source 交给工厂统一在 __DEV__ 下挂载（_self/_source 不可枚举、不可重定义）
  return elementFactory(type, key, ref, self, source, owner, props);
}

/** jsx：自动运行时主入口 */
export function jsx<Type>(
  type: Type,
  config?: ElementConfig | null,
  maybeKey?: ReactKey,
  ...children: unknown[]
): ReactElement<Type> {
  return jsxCommon(type, config ?? null, maybeKey, children);
}

/**
 * jsxs：编译器保证 children 已是数组时调用（多子元素路径）。
 * 官方两个函数体完全同构，只差编译器约定（jsxs 省一次数组拷贝）；
 * 这里直接复用同一份逻辑，并在注释里说明区别。
 */
export function jsxs<Type>(
  type: Type,
  config?: ElementConfig | null,
  maybeKey?: ReactKey,
  ...children: unknown[]
): ReactElement<Type> {
  return jsxCommon(type, config ?? null, maybeKey, children);
}

/** jsxDEV：dev 构建专用，记录 _source / _self（官方还在此做 key 校验与警告） */
export function jsxDEV<Type>(
  type: Type,
  config: ElementConfig | null,
  maybeKey: ReactKey | undefined,
  _isStaticChildren: boolean,
  source: { fileName: string; lineNumber: number; columnNumber: number } | null,
  self: unknown,
): ReactElement<Type> {
  if (__DEV__) {
    validateElementType(type, source ? source.fileName : null);
  }
  // jsxDEV 的语义：_source / _self 由工厂在 dev 下挂载（jsx/jsxs 传 undefined 表示"无源码信息"）
  return jsxCommon(type, config, maybeKey, [], source, self);
}
