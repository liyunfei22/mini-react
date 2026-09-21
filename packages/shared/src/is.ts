// 类型判定工具 —— 对应官方 shared 里的 isPlainObject / objectIs 等。
// TS 的 type guard 让判断之后能自动收窄类型。

type Mixed = unknown;

export function isArray(value: Mixed): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: Mixed): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isFunction(value: Mixed): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

export function isString(value: Mixed): value is string {
  return typeof value === 'string';
}

export function isNumber(value: Mixed): value is number {
  return typeof value === 'number';
}

export function isSymbol(value: Mixed): value is symbol {
  return typeof value === 'symbol';
}

/** 仅当普通对象（原型是 Object.prototype 或 null）时返回 true */
export function isPlainObject(value: Mixed): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Object.is —— React 判断状态是否变更（bailout）用的就是它 */
export function objectIs(x: Mixed, y: Mixed): boolean {
  if (x === y) {
    // 区分 +0 与 -0：1/x 的符号不同
    return x !== 0 || 1 / (x as number) === 1 / (y as number);
  }
  // NaN 是唯一"与自身不等"的值
  return !(x === x) && !(y === y);
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

/** 安全的 hasOwnProperty */
export function hasOwn(obj: object, key: PropertyKey): boolean {
  return hasOwnProperty.call(obj, key);
}