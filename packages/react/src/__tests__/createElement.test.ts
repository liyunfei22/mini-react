import { describe, expect, it } from 'vitest';
import { createElement, Fragment, isValidElement, REACT_ELEMENT_TYPE } from '../index';

function withDefaultProps(comp: () => unknown, defaults: Record<string, unknown>): () => unknown {
  (comp as unknown as { defaultProps?: Record<string, unknown> }).defaultProps = defaults;
  return comp;
}

describe('createElement —— ReactElement 的形状与稳定契约', () => {
  it('最小编制：$$typeof / type / key / ref / props', () => {
    const el = createElement('div', null);
    expect(el.$$typeof).toBe(REACT_ELEMENT_TYPE);
    // $$typeof 用 Symbol.for，跨模块/跨环境单例
    expect(el.$$typeof).toBe(Symbol.for('react.element'));
    expect(el.type).toBe('div');
    expect(el.key).toBeNull();
    expect(el.ref).toBeNull();
    expect(el.props).toEqual({});
  });

  it('单 children 不包数组；多 children 成数组', () => {
    const single = createElement('span', null, 'hello');
    expect(single.props.children).toBe('hello');

    const multi = createElement('ul', null, 'a', 'b', 'c');
    expect(multi.props.children).toEqual(['a', 'b', 'c']);
  });

  it('key / ref 从 config 剥离，绝不进入 props', () => {
    const ref = () => {};
    const el = createElement('div', { key: 'k1', ref, title: 't' }, 'x');
    expect(el.key).toBe('k1');
    expect(el.ref).toBe(ref);
    expect(el.props).toEqual({ title: 't', children: 'x' });
  });

  it('默认忽略 __self / __source（保留给 dev 工具）', () => {
    const el = createElement('div', { __self: 's', __source: 'src' });
    expect(el.props).toEqual({});
  });

  it('defaultProps 兜底：只在 props 对应值为 undefined 时生效', () => {
    const Comp = withDefaultProps(() => createElement('div', null), { x: 'X', y: 'Y' });
    const withY = createElement(Comp, { y: 'overridden' });
    expect(withY.props).toEqual({ x: 'X', y: 'overridden' });
  });
});

describe('isValidElement —— 判断对象是不是 ReactElement', () => {
  it('对 createElement 产物为 true', () => {
    expect(isValidElement(createElement('div', null))).toBe(true);
  });

  it('对非 element 为 false', () => {
    expect(isValidElement(null)).toBe(false);
    expect(isValidElement({})).toBe(false);
    expect(isValidElement(REACT_ELEMENT_TYPE)).toBe(false);
    expect(isValidElement('div')).toBe(false);
    expect(isValidElement(42)).toBe(false);
  });

  it('对 Fragment（Symbol）为 false —— Fragment 不是 element', () => {
    expect(isValidElement(Fragment)).toBe(false);
  });
});

describe('dev 校验（__DEV__ 分支）', () => {
  it('DEV 下非法 type 直接抛错（PROD 构建里该分支被 DCE）', () => {
    // 本测试由 vitest define 固定 __DEV__=true；PROD 静默行为在打包章节用产物验证
    expect(() => createElement({} as unknown as string, null)).toThrow(/Element type is invalid/);
    expect(() => createElement(42 as unknown as string, null)).toThrow(/Element type is invalid/);
  });

  it('合法 type（函数/字符串/符号）不抛错', () => {
    expect(() => createElement('div', null)).not.toThrow();
    function Comp() {
      return createElement('div', null);
    }
    expect(() => createElement(Comp, null)).not.toThrow();
    expect(() => createElement(Fragment, null)).not.toThrow();
  });
});
