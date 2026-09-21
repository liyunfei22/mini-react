import { describe, expect, it } from 'vitest';
import { jsx, jsxs, Fragment } from '../jsx-runtime';
import { jsxDEV } from '../jsx-dev-runtime';
import { createElement, REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from '../index';

describe('jsx 自动运行时', () => {
  it('maybeKey 由第三个参数传入（区别于 config.key）', () => {
    const el = jsx('div', { id: 'a' }, 'k');
    expect(el.key).toBe('k');
    expect(el.type).toBe('div');
    expect(el.props).toEqual({ id: 'a' });
    expect(el.$$typeof).toBe(REACT_ELEMENT_TYPE);
  });

  it('jsx 与 createElement 产出同构（config.children == 显式 children）', () => {
    const fromJsx = jsx('p', { children: 'hi' });
    const fromCreate = createElement('p', null, 'hi');
    expect(fromJsx.type).toBe(fromCreate.type);
    expect(fromJsx.props.children).toBe(fromCreate.props.children);
    expect(fromJsx.key).toBe(fromCreate.key);
  });

  it('jsxs：多子元素直接走 config.children 数组', () => {
    const el = jsxs('ul', {
      children: [jsx('li', null), jsx('li', null)],
    });
    // 自动运行时把数组收进 props.children
    expect(Array.isArray(el.props.children)).toBe(true);
    expect((el.props.children as unknown[]).length).toBe(2);
  });

  it('jsxDEV 记录 _source / _self（仅 dev）', () => {
    const source = { fileName: 'demo.tsx', lineNumber: 1, columnNumber: 2 };
    const el = jsxDEV('span', null, undefined, false, source, null);
    expect(el.key).toBeNull();
    // __DEV__=true 时挂上不可枚举的 _source
    expect(el._source).toEqual(source);
  });
});

describe('Fragment', () => {
  it('jsx-runtime 的 Fragment 与 react 包一致（Symbol.for 单例）', () => {
    expect(Fragment).toBe(REACT_FRAGMENT_TYPE);
    expect(Fragment).toBe(Symbol.for('react.fragment'));
  });
});
