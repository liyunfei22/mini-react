---
title: React 源码解析 02：createElement 与 JSX 运行时——虚拟 DOM 的诞生
summary: createElement 到底做了哪三件事、ReactElement 为什么用 Symbol.for 标识、key/ref 如何从 config 剥离、JSX 自动运行时（jsx/jsxs/jsxDEV）与经典 createElement 的双轨关系。附手写 mini-render 让元素树真实渲染。
tags: [前端, React, 源码分析]
cover: https://cdn.jsdelivr.net/gh/liyunfei22/mini-react@main/articles/02-createElement与JSX运行时/assets/cover.png
date: 2026-09-21
series: mini-react 源码解析
seriesIndex: 2
originalSource: https://github.com/liyunfei22/mini-react
draft: true
---

# 问题：key 用错为什么会让输入框「串位」，Symbol.for 为什么能跨库识别一个 element

`React.createElement('div', { className: 'x' }, 'Hi')` 大概是 React 世界里被调用次数最多的一句。它做的不是「造 DOM」，而是造一个**纯粹的描述对象**——行话叫 element（常被笼统喊成「虚拟 DOM 节点」）。第 2 章只交付这一层：element 长什么样、哪些字段进 props、哪些字段被特别对待。两个最容易被问倒的问题，答案都藏在这个对象里。

**key 用错为什么「串位」？**

先看 createElement 三件事里最关键的一件：它把 `key`、`ref` 从 config 里「抽」出来，放到 element 顶层，而不是塞进 props。这不是洁癖，而是在给 diff 铺路——reconciler 判断「上一次渲染的哪个 Fiber 对应这一次的哪个 element」时，读的就是这个顶层的 `element.key`。

key 省略时（默认 `null`），React 就用**位置**当身份：第 0 个对第 0 个、第 1 个对第 1 个。一旦列表增删或重排，位置和内容的对应关系就错位了。一个非受控 `<input>` 的输入值存在 DOM 本身里——React 复用了位置 0 的那个 input 节点，于是你打在「第二行」的字，更新后出现在了「第一行」。这就是「串位」。

稳定的 key 等于在告诉 React：**复用/废弃的判定依据是「身份」而不是「顺序」**。这套 diff 到第 8 章（Reconciliation）才会全量展开，本章只需先记住 key 是 element 的「身份证」，由 createElement 单独保管。

**Symbol.for 为什么能跨库识别？**

element 第一个字段 `$$typeof` 的值是 `Symbol.for('react.element')`，而不是 `Symbol('react.element')`。

`Symbol()` 每次调用都返回一个**全新**的符号；而 `Symbol.for(key)` 查的是**全局符号注册表**——第一次调用把 key 登记进去，之后任何地方（react 包、react-dom、react-reconciler，甚至同一页面装了两份不同版本的 react）用同一个 key 取到的都是**同一个**符号实例。于是 `isValidElement` 里那句 `obj.$$typeof === REACT_ELEMENT_TYPE` 才能跨包成立：react 生产 element，reconciler 消费 element，两边 import 的常量虽是两份，`Symbol.for` 保证它们指向同一个符号。

这是 `$$typeof` 用 Symbol 的另一个理由：JSON 序列化不掉 Symbol，攻击者没法伪造一个「长得像 element」的对象注入（Dan Abramov 那篇经典的 Why Do React Elements Have a $$typeof Property 专讲这段安全史）。

## 官方实现里发生了什么

### ReactElement.js：一个工厂 + 一份 RESERVED_PROPS

官方 `packages/react/src/ReactElement.js` 里，`createElement` 干的事可以压成一句话：**剥 key/ref → 归一化 children → 交给工厂**（浓缩示意）：

```js
const RESERVED_PROPS = {          // 保留字：抽出来放进 element 顶层，不进 props
  key: true,
  ref: true,
  __self: true,
  __source: true,
};

function createElement(type, config, children) {
  let propName;
  const props = {};
  let key = null, ref = null;

  if (config != null) {
    if (hasValidRef(config)) ref = config.ref;
    if (hasValidKey(config)) key = '' + config.key;   // key 强制 stringify
    for (propName in config) {
      // 不是保留字、是自身属性，才进 props
      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;                          // 单儿子：裸值
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);           // 多儿子：数组
    for (let i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
    props.children = childArray;
  }

  return ReactElement(type, key, ref, undefined, undefined, ReactCurrentOwner.current, props);
}
```

（`defaultProps` 兜底与 dev 下的 key/ref 弃用警告省略。）注意三条稳定契约：`key` 会被 `'' + key` 强制转字符串；children **单个不包数组、多个才成数组**；`ReactCurrentOwner.current` 记进 `_owner`，标出「这个 element 是哪个函数组件造的」。

最底层的工厂 `ReactElement(type, key, ref, self, source, owner, props)` 只做一件事：把这些参数拼成一个普通对象，dev 下再挂上不可枚举的 `_store`/`_self`/`_source`。dev 分支里，`ReactElementValidator.js` 的 `validateElementType` 会先校验 type 合法（字符串 / 函数 / symbol，或带 `$$typeof` 的对象），非法就 throw。

### jsx/ReactJSXElement.js：jsx / jsxs / jsxDEV 三入口，key 走第三参数

新版 JSX 编译（Babel automatic / esbuild / SWC）不再生成 `React.createElement(...)`，而是生成对 `jsx-runtime` 里 `jsx`/`jsxs` 的调用。官方 `packages/react/src/jsx/ReactJSXElement.js` 导出三个入口：

```js
export function jsx(type, config, maybeKey) { ... }
export function jsxs(type, config, maybeKey) { ... }   // 编译器约定：children 已是数组
export function jsxDEV(type, config, maybeKey, isStaticChildren, source, self) { ... }
```

它和 `createElement` 的关键区别在 key 的来源：编译后的 `<div key="k" />` 长成 `jsx('div', {}, "k")`——**key 作为第三个参数 `maybeKey` 单独传入**，而不是放在 config 里。生产实现（浓缩）：

```js
function jsxProd(type, config, maybeKey) {
  const props = {};
  let key = null, ref = null;
  if (maybeKey !== undefined) key = '' + maybeKey;   // key 走第三参数
  if (hasValidKey(config))    key = '' + config.key; // 兼容 {...props} 展开的 key（已弃用）
  if (hasValidRef(config))    ref = config.ref;
  for (propName in config) {
    if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
      props[propName] = config[propName];
    }
  }
  return ReactElement(type, key, ref, undefined, undefined, ReactCurrentOwner.current, props);
}
```

这里的 `RESERVED_PROPS` 只剩 `{ key: true, ref: true }`——因为自动运行时不再从 config 收 `__self`/`__source`（那是 `jsxDEV` 的显式形参）。`jsx` 与 `jsxs` 函数体完全同构，差别只在 dev 校验的 `isStaticChildren` 标志：`jsxs` 期望 children 已是数组（静态多子路径），`jsx` 则逐 child 校验。`jsxDEV` 额外接收 `source`/`self` 给元素挂源码位置，dev 下三者都走 `jsxWithValidation`——type 校验、逐子节点 key 校验、展开 key 弃用警告等一整套 dev 检查。

一个容易忽略的事实：**官方这里的 `ReactElement` 工厂与 ReactElement.js 里那个是两份几乎一样的代码**，jsx 这份在 dev 下还会 `Object.freeze(element.props)`。原因是让 `react/jsx-runtime` 单独打包时不连带 validator 的依赖。

## 我们动手：mini-实现

本仓库把这条链路落地成六个文件，对照关系如下：

| 文件 | 对应官方 | 职责 |
| --- | --- | --- |
| `packages/react/src/ReactElement.ts` | ReactElement.js + ReactElementValidator.js（部分） | 工厂 + createElement + isValidElement + Fragment |
| `packages/react/src/ReactJSXElement.ts` | jsx/ReactJSXElement.js | jsx / jsxs / jsxDEV 三入口 |
| `packages/react/src/jsx-runtime.ts` | react/jsx-runtime.js | 对外门面 + JSX 类型命名空间 |
| `packages/react/src/jsx-dev-runtime.ts` | react/jsx-dev-runtime.js | dev 专用门面 |
| `packages/react/src/ReactCurrentOwner.ts` | ReactCurrentOwner.js | `_owner` 记录（当前恒 null） |
| `packages/shared/src/ReactSymbols.ts` | shared/ReactSymbols.js | `Symbol.for` 类型标识 |

### ReactElement.ts：一条 createElement 主线

`createElement` 语义与官方一字不差，只砍掉 `ReactElementValidator.js` 的绝大部分校验（见差异表）。核心（`ReactElement.ts`）：

```ts
export function createElement(type, config, ...children) {
  if (__DEV__) validateElementType(type, null);        // 唯一保留的 dev 校验

  const props = {};
  let key = null, ref = null;

  if (config != null) {
    if (hasValidRef(config)) ref = config.ref;         // ① 剥 ref
    if (hasValidKey(config)) key = '' + config.key;    // ② 剥 key
    for (propName in config) {
      if (hasOwn(config, propName) && !hasOwn(RESERVED_PROPS, propName)) {
        props[propName] = config[propName];            // ③ 其余进 props
      }
    }
  }

  const childrenLength = children.length;
  if (childrenLength === 1) {
    props.children = children[0];                      // 单个不包数组
  } else if (childrenLength > 1) {
    const childArray = new Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) childArray[i] = children[i];
    props.children = childArray;                       // 多个成数组
  }
  // defaultProps 兜底 …
  return ReactElement(type, key, ref, undefined, undefined, ReactCurrentOwner.current, props);
}
```

`RESERVED_PROPS = { key: true, ref: true, __self: true, __source: true }`，所以 `createElement('div', { __self: 's', __source: 'src' })` 的 props 是 `{}`——这两个字段只留给 dev 工具定位源码，绝不进 props。工厂 `ReactElement` 与官方一致，dev 下用 `Object.defineProperty` 挂不可枚举、不可重定义的 `_self`/`_source`。

`isValidElement` 也在这份文件里：`typeof obj === 'object' && obj.$$typeof === REACT_ELEMENT_TYPE`，一行判定对象身份。

### ReactJSXElement.ts + jsx-runtime.ts：自动运行时复用同一工厂

`ReactJSXElement.ts` 没有自己的工厂，而是 `import { ReactElement as elementFactory } from './ReactElement'`：

```ts
function jsxCommon(type, config, maybeKey, children, source?, self?) {
  const props = {};
  let key = null, ref = null;
  if (maybeKey !== undefined) key = '' + maybeKey;     // key 由第三方参数单独传入

  if (config != null) {
    if (hasValidRef(config)) ref = config.ref;
    for (propName in config) {
      if (hasOwn(config, propName) && !hasOwn(RESERVED_PROPS, propName)) {
        props[propName] = config[propName];            // children 不在保留字里，自然流入 props
      }
    }
  }
  // …rest 参数 children 的归一化（手写调用兜底），再 defaultProps 兜底
  return elementFactory(type, key, ref, self, source, owner, props);   // 复用同一工厂
}

export function jsx(type, config, maybeKey, ...children) {
  return jsxCommon(type, config ?? null, maybeKey, children);
}
export function jsxs(type, config, maybeKey, ...children) {
  return jsxCommon(type, config ?? null, maybeKey, children);          // 与 jsx 同构
}
export function jsxDEV(type, config, maybeKey, _isStaticChildren, source, self) {
  if (__DEV__) validateElementType(type, source ? source.fileName : null);
  return jsxCommon(type, config, maybeKey, [], source, self);          // children 已由 config 携带
}
```

于是「双轨」在本仓库里是**真·同源**：`jsx('p', { children: 'hi' })` 与 `createElement('p', null, 'hi')` 落在同一个 `elementFactory` 上，产出的 element 契约完全一致——测试里还专门断言了这条「产出同构」（见验证节）。这里的 `RESERVED_PROPS` 只有 `{ key, ref }`，与官方的 jsx 运行时一致；`jsxDEV` 的 `_source`/`_self` 交由工厂在 `__DEV__` 下统一挂载。

`jsx-runtime.ts` 是自动运行时的对外门面，只 re-export `Fragment/jsx/jsxs`，并声明 `namespace JSX`（`Element`、`IntrinsicElements`、`IntrinsicAttributes` 等）给 TS 做类型校验。playground 的 `tsconfig` 配了 `"jsx": "react-jsx"` + `"jsxImportSource": "@mini-react/react"`，所以 `<a/>` 会被编译成 `import { jsx } from '@mini-react/react/jsx-runtime'`；dev 态则经 `jsx-dev-runtime` 走 `jsxDEV`。

### playground Demo01 + mini-render：让元素树落地成 DOM

`apps/playground/src/demos/01-create-element/Demo01.tsx` 刻意用 JSX 书写，跑起来就是一路 `jsx`/`jsxs` 调用堆叠：

```tsx
export function Demo01(): ReactElement {
  return (
    <section className="demo-card">
      <h2>01 · createElement 与 JSX 运行时</h2>
      <ul>
        {ITEMS.map((text) => (
          <li key={text}>{text}</li>      // key={text} 编译成 jsx('li', ..., text) 的第三参数
        ))}
      </ul>
    </section>
  );
}
```

怎么「看见」这些编译产物的真实形状？第 1 章的 `mini-render.ts` 用一段纯递归把 element 树变回 DOM：

```ts
export function renderElement(element: ReactElement): Node {
  const { type, props } = element;
  if (typeof type === 'string') {            // 内置标签：建 DOM
    const node = document.createElement(type);
    for (const key in props) {               // className / style / onXxx / setAttribute…
      // children 单独处理，交给 appendChildren 递归
    }
    appendChildren(node, props.children);
    return node;
  }
  // 函数组件 / Fragment 要 reconciler（第 3~4 章），这里抛醒目提示而不是渲染错
  throw new Error(`[mini-render] 第 1 章只支持 DOM 标签（string type）…`);
}
```

它的真正价值到第 4 章才凸显：先用「递归一口气走完」的心智模型看 element，好和第 4 章「Fiber 迭代可中断」形成对照。当前的 `pnpm playground:dev` 里，`main.tsx` 已经用 `createRoot(...).render(<App/>)`（后文 reconciler）接管了渲染，`mini-render.ts` 作为第 1 章的引子保留在仓库里。

## 差异对照表

| 维度 | 官方 React 18.2 | 本仓库 mini 版 |
| --- | --- | --- |
| dev 校验 | 一套全量校验：`validateElementType` + 逐子节点 key 校验 + 展开 key/ref 弃用警告 | 只保留 `validateElementType`（type 非法即 throw），其余全砍 |
| `createElement` 契约 | key/ref 剥离、单/多 children 归一化、defaultProps 兜底 | 与官方语义一致 |
| element 工厂 | 两份几乎一样的工厂（ReactElement.js 与 jsx/ReactJSXElement.js 各一份，后者 dev 下 freeze props） | 收敛为一个 `ReactElement`，两轨共用 |
| jsx 的 RESERVED_PROPS | `{ key, ref }`（__self/__source 走 jsxDEV 参数） | 一致 |
| key 来源 | maybeKey（第三参数）+ config.key（展开 key，弃用但兼容） | 只读 maybeKey，展开 key 被静默剥离 |
| dev 冻结 | dev 构建 `Object.freeze(element.props)` / `element` | 不 freeze |
| 类型声明 | @types/react 独立维护 | 手写 `namespace JSX`（宽松校验） |

## 验证

```bash
pnpm test            # createElement.test.ts（10 用例 / 25 断言）+ jsx-runtime.test.ts（5 用例 / 13 断言）
pnpm playground:dev  # 打开 http://localhost:5173，看 Demo01 卡片（dev 走 jsxDEV → jsx-dev-runtime）
```

两个测试文件共 15 用例 / 38 断言，最有代表性的几条：

- `el.$$typeof` 严格等于 `Symbol.for('react.element')`；
- key / ref 剥离：`createElement('div', { key: 'k1', ref, title: 't' }, 'x')` 的 props 是 `{ title: 't', children: 'x' }`；
- 单/多 children：`createElement('span', null, 'hello')` 的 `props.children` 是 `'hello'`，三个儿子则 `toEqual(['a','b','c'])`；
- `jsx('div', { id: 'a' }, 'k')` 的 key 是 `'k'`（第三参数）；`jsxDEV('span', null, undefined, false, source, null)` 的 `_source` 是 `source`；
- `jsx-runtime` 导出的 `Fragment` 严格等于 `Symbol.for('react.fragment')`。

`__DEV__` 下非法 type 抛错那条（`createElement({}, null)` 抛 `Element type is invalid`）只在 dev 分支存在，prod 里被 DCE 掉——这条线到第 1 章的构建期替换里闭环。

下一章预告：**Fiber 数据结构**——element 只是「描述」，Fiber 才是可中断渲染的最小工作单元；三指针（child/sibling/return）+ 双缓冲，把递归渲染变成可游标的遍历。