// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Suspense, createElement, useState } from '@mini-react/react';
import { createRoot, flushSync } from '../index';

function tick(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 造一个「未就绪就 throw thenable、就绪就返回数据」的读取器（对齐 React 19 `use(promise)` 心智模型） */
function makeReader() {
  let resolved: string | null = null;
  let resolve!: (v: string) => void;
  const promise = new Promise<string>((res) => {
    resolve = res;
  });
  const read = (): string => {
    if (resolved === null) {
      throw promise; // Suspense 就靠接住这个 thenable 来"挂起"
    }
    return resolved;
  };
  const settle = (v: string): void => {
    resolved = v;
    resolve(v);
  };
  return { read, settle };
}

describe('Suspense（第 19 章：挂起 → fallback → 唤醒 primary）', () => {
  it('挂起时显示 fallback，promise resolve 后切回 primary', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const { read, settle } = makeReader();
    let setShow!: (v: boolean) => void;

    function Async() {
      return createElement('div', null, read());
    }
    function App() {
      const [show, s] = useState(false);
      setShow = s;
      return createElement(
        'div',
        null,
        show
          ? createElement(Suspense, { fallback: createElement('p', null, 'loading…') }, createElement(Async))
          : createElement('p', null, 'idle'),
      );
    }

    createRoot(container).render(createElement(App));
    expect(container.textContent).toBe('idle');

    // 触发挂起 → 立即显示 fallback（同步 flush 里完成 fallback 渲染）
    flushSync(() => setShow(true));
    expect(container.textContent).toBe('loading…');

    // resolve → 唤醒 → 切回 primary
    settle('data');
    await tick();
    expect(container.textContent).toBe('data');
  });

  it('挂起后不忙循环：resolve 前渲染计数不再增长', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const { read, settle } = makeReader();
    let renders = 0;
    let setShow!: (v: boolean) => void;

    function Async() {
      renders++;
      return createElement('div', null, read());
    }
    function App() {
      const [show, s] = useState(false);
      setShow = s;
      return createElement(
        Suspense,
        { fallback: createElement('p', null, 'loading…') },
        createElement(show ? Async : 'span', null),
      );
    }

    createRoot(container).render(createElement(App));
    flushSync(() => setShow(true));
    expect(container.textContent).toBe('loading…');
    const rendersAtSuspend = renders;

    // resolve 前多等几个宏任务：suspendedLanes 应排除该 lane，不再反复挂起
    await tick();
    await tick();
    expect(renders).toBe(rendersAtSuspend);
    expect(container.textContent).toBe('loading…');

    settle('ready');
    await tick();
    expect(container.textContent).toBe('ready');
  });

  it('无 Suspense 边界时 throw thenable 会被原样抛出', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const { read } = makeReader();

    function Async() {
      return createElement('div', null, read());
    }

    const root = createRoot(container);
    let thrown: unknown = null;
    try {
      root.render(createElement(Async));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).not.toBeNull(); // 原样抛回 thenable（mini 无错误边界承接）
  });

  it('嵌套 Suspense：命中「最近」边界，外层不显示自己的 fallback', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const { read, settle } = makeReader();

    function Async() {
      return createElement('div', null, read());
    }
    function App() {
      return createElement(
        Suspense,
        { fallback: createElement('p', null, 'outer-fallback') },
        createElement(
          'section',
          null,
          createElement(
            Suspense,
            { fallback: createElement('p', null, 'inner-fallback') },
            createElement(Async),
          ),
        ),
      );
    }

    createRoot(container).render(createElement(App));
    // 只有内层边界承接挂起，外层仍渲染其 primary（= 内层的 fallback）
    expect(container.textContent).toBe('inner-fallback');

    settle('ok');
    await tick();
    expect(container.textContent).toBe('ok');
  });
});