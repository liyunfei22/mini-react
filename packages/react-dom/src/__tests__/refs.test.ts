// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement, createRef, forwardRef } from '@mini-react/react';
import { createRoot } from '../index';

describe('refs / forwardRef', () => {
  it('createRef 对象在 commit 后指向 DOM 节点', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const ref = createRef<HTMLElement>();

    createRoot(container).render(createElement('div', { ref }, 'x'));

    expect(ref.current).toBe(container.querySelector('div'));
  });

  it('回调 ref 收到 DOM 节点；卸载时收到 null', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let seen: unknown = 'unset';

    function App({ show }: { show: boolean }) {
      return show ? createElement('div', { ref: (node: unknown) => (seen = node) }, 'x') : null;
    }

    const root = createRoot(container);
    root.render(createElement(App, { show: true }));
    expect(seen).toBe(container.querySelector('div'));

    root.render(createElement(App, { show: false }));
    expect(seen).toBeNull(); // 卸载时 detachRef 传 null
  });

  it('卸载后对象 ref 置 null', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const ref = createRef<HTMLElement>();

    function App({ show }: { show: boolean }) {
      return show ? createElement('div', { ref }, 'x') : null;
    }

    const root = createRoot(container);
    root.render(createElement(App, { show: true }));
    expect(ref.current).toBe(container.querySelector('div'));

    root.render(createElement(App, { show: false }));
    expect(ref.current).toBeNull();
  });

  it('forwardRef 把 ref 转发到内部 DOM', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    const FancyDiv = forwardRef<Record<string, never>, HTMLElement>((_props, ref) =>
      createElement('div', { ref }, 'hello'),
    );
    const ref = createRef<HTMLElement>();

    createRoot(container).render(createElement(FancyDiv as unknown as string, { ref }));

    expect(ref.current).toBe(container.querySelector('div'));
    expect(container.textContent).toBe('hello');
  });

  it('移除 ref：div 从 ref={r} 变 ref=null，r.current 置空', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const r = createRef<HTMLElement>();

    function App({ withRef }: { withRef: boolean }) {
      return withRef ? createElement('div', { ref: r }, 'x') : createElement('div', null, 'x');
    }

    const root = createRoot(container);
    root.render(createElement(App, { withRef: true }));
    expect(r.current).toBe(container.querySelector('div'));

    root.render(createElement(App, { withRef: false }));
    expect(r.current).toBeNull(); // 移除 ref 也要 detach
  });

  it('换 ref：div ref 从 a 换到 b，旧 a 置空', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const a = createRef<HTMLElement>();
    const b = createRef<HTMLElement>();

    let useB = false;
    function App() {
      const which = useB ? b : a;
      return createElement('div', { ref: which }, 'x');
    }

    const root = createRoot(container);
    root.render(createElement(App));
    expect(a.current).toBe(container.querySelector('div'));

    useB = true;
    root.render(createElement(App));
    expect(a.current).toBeNull(); // 旧 ref 被 detach
    expect(b.current).toBe(container.querySelector('div')); // 新 ref 被 attach
  });
});
