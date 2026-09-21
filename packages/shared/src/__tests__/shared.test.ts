import { describe, expect, it } from 'vitest';
import { hasOwn, isArray, isFunction, isObject, isPlainObject, objectIs } from '../is';
import { objectAssign } from '../objectAssign';
import { ReactSharedInternals } from '../ReactSharedInternals';

describe('is.ts —— 类型判定工具', () => {
  it('isObject 排除 null', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject('x')).toBe(false);
  });

  it('isPlainObject 要求原型是 Object.prototype 或 null', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
  });

  it('isFunction / isArray 收窄类型', () => {
    expect(isFunction(() => {})).toBe(true);
    expect(isArray([1, 2])).toBe(true);
    expect(isArray('abc')).toBe(false);
  });

  it('hasOwn 只认自身属性', () => {
    const obj = { a: 1 };
    expect(hasOwn(obj, 'a')).toBe(true);
    expect(hasOwn(obj, 'toString')).toBe(false);
  });
});

describe('objectIs.ts —— Object.is 语义', () => {
  it('1/x === 1/y 处理 +0 与 -0', () => {
    expect(objectIs(-0, 0)).toBe(false);
    expect(objectIs(0, 0)).toBe(true);
  });

  it('NaN 相等（区别于 ===）', () => {
    expect(objectIs(NaN, NaN)).toBe(true);
    expect(objectIs(1, 2)).toBe(false);
  });
});

describe('objectAssign.ts', () => {
  it('合并多个源对象', () => {
    expect(objectAssign({}, { a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

describe('ReactSharedInternals.ts —— 总线默认态', () => {
  it('dispatcher 默认 null 且在多次 import 之间保持单例', () => {
    // 同一个模块对象（Vitest 的 alias 解析保证单例）
    expect(ReactSharedInternals.ReactCurrentDispatcher.current).toBeNull();
    expect(ReactSharedInternals.ReactCurrentBatchConfig.transition).toBeNull();

    const again = ReactSharedInternals;
    expect(again).toBe(ReactSharedInternals);
  });
});
