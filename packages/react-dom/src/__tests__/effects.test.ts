// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement, useEffect, useLayoutEffect } from '@mini-react/react';
import { flushPassiveEffects } from '@mini-react/react-reconciler';
import { createRoot } from '../index';

describe('useEffect / useLayoutEffect 副作用链路', () => {
  it('useLayoutEffect 同步（commit 内），useEffect 异步（paint 后）', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const log: string[] = [];

    function App() {
      useLayoutEffect(() => {
        log.push('layout');
      }, []);
      useEffect(() => {
        log.push('passive');
      }, []);
      return createElement('div', null, 'x');
    }

    createRoot(container).render(createElement(App));

    // 同步 commit 完成后，只有 layout 跑过；passive 还没
    expect(log).toEqual(['layout']);

    flushPassiveEffects();
    expect(log).toEqual(['layout', 'passive']);
  });

  it('cleanup 先于下一次 create，且 deps 不变不重跑', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const log: string[] = [];

    // 注意：依赖要闭包渲染时的 props 快照（而非模块级可变变量），才能正确演示 cleanup。
    function App({ tag }: { tag: number }) {
      useEffect(() => {
        log.push(`create:${tag}`);
        return () => log.push(`cleanup:${tag}`);
      }, [tag]);
      return createElement('div', null, String(tag));
    }

    const root = createRoot(container);
    root.render(createElement(App, { tag: 1 }));
    flushPassiveEffects();
    expect(log).toEqual(['create:1']);

    // deps 不变 → 不重跑
    root.render(createElement(App, { tag: 1 }));
    flushPassiveEffects();
    expect(log).toEqual(['create:1']);

    // deps 变化 → 先 cleanup 再 create
    root.render(createElement(App, { tag: 2 }));
    flushPassiveEffects();
    expect(log).toEqual(['create:1', 'cleanup:1', 'create:2']);
  });

  it('卸载时运行 cleanup', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const log: string[] = [];

    function Child() {
      useEffect(() => {
        return () => log.push('cleanup-child');
      }, []);
      return createElement('span', null, 'c');
    }

    function App({ show }: { show: boolean }) {
      return show ? createElement(Child) : null;
    }

    const root = createRoot(container);
    root.render(createElement(App, { show: true }));
    flushPassiveEffects();

    root.render(createElement(App, { show: false }));
    flushPassiveEffects();
    expect(log).toEqual(['cleanup-child']);
  });

  it('deps 不变重渲染后再卸载，cleanup 仍触发（不因 carried destroy 被跳过）', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const log: string[] = [];

    function Child() {
      useEffect(() => {
        return () => log.push('cleanup');
      }, []); // deps=[] 恒不变
      return createElement('span', null, 'c');
    }

    function App({ show }: { show: boolean }) {
      return show ? createElement(Child) : null;
    }

    const root = createRoot(container);
    root.render(createElement(App, { show: true }));
    flushPassiveEffects();

    // deps 不变重渲染：effect 以 HookPassive（无 HasEffect）carry destroy，不重跑 create
    root.render(createElement(App, { show: true }));
    flushPassiveEffects();
    expect(log).toEqual([]);

    // 卸载：carried destroy 必须仍被清理
    root.render(createElement(App, { show: false }));
    flushPassiveEffects();
    expect(log).toEqual(['cleanup']);
  });
});
