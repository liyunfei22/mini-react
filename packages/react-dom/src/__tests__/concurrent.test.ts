// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement, useState, useTransition } from '@mini-react/react';
import { createRoot, flushSync } from '../index';

function tick(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('并发特性', () => {
  it('useTransition 包裹的更新是异步的（并发渲染，不同步阻塞）', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let setValue!: (v: number) => void;
    let start!: (cb: () => void) => void;

    function App() {
      const [value, s] = useState(0);
      setValue = s;
      const [_isPending, st] = useTransition();
      start = st;
      return createElement('div', null, String(value));
    }

    createRoot(container).render(createElement(App));
    expect(container.textContent).toBe('0');

    start(() => setValue(1));

    // 同步结束时 DOM 还未更新（transition 走并发 → 异步渲染）
    expect(container.textContent).toBe('0');

    // 关键判别：冲刷掉所有 microtask 后，transition 更新仍不该落地——
    // 它走 Scheduler 的宏任务（MessageChannel）；若被 sync 的 setPending(false) 吞掉
    // 就会在这里提前变成 1。这一步正是"真异步"与"假异步"的分界。
    await Promise.resolve();
    expect(container.textContent).toBe('0');

    await tick();
    expect(container.textContent).toBe('1');
  });

  it('flushSync 同步 flush 一批更新', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let setValue!: (v: number) => void;

    function App() {
      const [value, s] = useState(0);
      setValue = s;
      return createElement('div', null, String(value));
    }

    createRoot(container).render(createElement(App));
    expect(container.textContent).toBe('0');

    // 普通 setState 不 flush；flushSync 里包一层 → 同步立即渲染
    flushSync(() => setValue(5));
    expect(container.textContent).toBe('5');
  });
});
