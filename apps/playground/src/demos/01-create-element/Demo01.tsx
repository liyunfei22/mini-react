import type { ReactElement } from '@mini-react/react';

const ITEMS = [
  'ReactElement 由 Symbol.for("react.element") 标识',
  'key / ref 从 config 剥离，绝不进 props',
  '单 children 不包数组，多 children 成数组',
  'jsx 运行时：key 由第三个参数单独传入',
];

/**
 * 01 · createElement 与 JSX 运行时。
 * 本函数刻意使用 JSX 语法 —— 编译后走 @mini-react/react/jsx-runtime 的 jsx/jsxs，
 * 与"经典 createElement"共享同一套 element 契约（对应文章里的"两条路径"）。
 */
export function Demo01(): ReactElement {
  return (
    <section className="demo-card">
      <h2>01 · createElement 与 JSX 运行时</h2>
      <p>这一整块是 JSX 自动运行时的编译产物（jsx/jsxs 调用堆叠）：</p>
      <ul>
        {ITEMS.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
      <pre>
        {`createElement('div', { className: 'app' },
  createElement('h1', null, '...'),
  Demo01())`}
      </pre>
    </section>
  );
}