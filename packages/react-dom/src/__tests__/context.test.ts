// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createContext, createElement, useContext, useState } from '@mini-react/react';
import { flushSyncCallbacks } from '@mini-react/react-reconciler';
import { createRoot } from '../index';

const Theme = createContext('light');

describe('Context', () => {
  it('无 Provider 时读默认值', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    function App() {
      return createElement('span', null, useContext(Theme));
    }

    createRoot(container).render(createElement(App));
    expect(container.textContent).toBe('light');
  });

  it('Provider 覆盖值', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    function Child() {
      return createElement('span', null, useContext(Theme));
    }
    function App() {
      return createElement(Theme.Provider, { value: 'dark' }, createElement(Child));
    }

    createRoot(container).render(createElement(App));
    expect(container.textContent).toBe('dark');
  });

  it('嵌套 Provider：内层遮蔽外层', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    function Child() {
      return createElement('span', null, useContext(Theme));
    }
    function App() {
      return createElement(
        Theme.Provider,
        { value: 'dark' },
        createElement(Theme.Provider, { value: 'pink' }, createElement(Child)),
      );
    }

    createRoot(container).render(createElement(App));
    expect(container.textContent).toBe('pink');
  });

  it('setState 改 Provider value，消费者看到新值', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let setTheme!: (v: string) => void;

    function Child() {
      return createElement('span', null, useContext(Theme));
    }
    function App() {
      const [t, set] = useState('light');
      setTheme = set;
      return createElement(Theme.Provider, { value: t }, createElement(Child));
    }

    const root = createRoot(container);
    root.render(createElement(App));
    expect(container.textContent).toBe('light');

    setTheme('dark');
    flushSyncCallbacks();
    expect(container.textContent).toBe('dark');
  });

  it('渲染抛错后 Provider 栈回收，后续渲染读回默认值', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    function Ok() {
      return createElement('span', null, useContext(Theme));
    }
    function Bad() {
      throw new Error('boom');
    }
    function App({ showBad }: { showBad: boolean }) {
      return createElement(
        Theme.Provider,
        { value: 'dark' },
        createElement(showBad ? Bad : Ok, null),
      );
    }

    const root = createRoot(container);
    root.render(createElement(App, { showBad: false }));
    expect(container.textContent).toBe('dark');

    // Provider 内抛错 → performSyncWorkOnRoot finally 应回收 Provider 栈
    expect(() => root.render(createElement(App, { showBad: true }))).toThrow('boom');

    // 之后渲染不含 Provider 的树：必须读回默认 'light'，而不是残留的 'dark'
    root.render(createElement(Ok, null));
    expect(container.textContent).toBe('light');
  });
});
