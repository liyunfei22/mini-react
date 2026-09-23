// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement, useCallback, useMemo, useRef } from '@mini-react/react';
import { createRoot } from '../index';

describe('useMemo / useCallback / useRef', () => {
  it('useMemo：deps 不变复用旧值、变才重算', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let computes = 0;

    function App({ n }: { n: number }) {
      const doubled = useMemo(() => {
        computes++;
        return n * 2;
      }, [n]);
      return createElement('div', null, String(doubled));
    }

    const root = createRoot(container);
    root.render(createElement(App, { n: 2 }));
    root.render(createElement(App, { n: 2 }));
    expect(computes).toBe(1);
    expect(container.textContent).toBe('4');

    root.render(createElement(App, { n: 3 }));
    expect(computes).toBe(2);
    expect(container.textContent).toBe('6');
  });

  it('useCallback：deps 不变返回同一引用，变则新引用', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let refA: (() => void) | null = null;

    function App({ n }: { n: number }) {
      const cb = useCallback(() => {}, [n]);
      refA = cb;
      return createElement('div', null, String(n));
    }

    const root = createRoot(container);
    root.render(createElement(App, { n: 1 }));
    const first = refA;
    root.render(createElement(App, { n: 1 }));
    expect(refA).toBe(first); // 同引用

    root.render(createElement(App, { n: 2 }));
    expect(refA).not.toBe(first); // 新引用
  });

  it('useRef：跨渲染返回同一个对象', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const seen: { current: number }[] = [];

    function App() {
      const ref = useRef(42);
      seen.push(ref);
      return createElement('div', null, String(ref.current));
    }

    const root = createRoot(container);
    root.render(createElement(App));
    root.render(createElement(App));

    expect(seen[0]).toBe(seen[1]); // 同一 ref 对象
    expect(seen[1]!.current).toBe(42);
  });
});
