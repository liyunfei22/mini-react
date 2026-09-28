// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement, useState, useTransition } from '@mini-react/react';
import { createRoot, flushSync } from '../index';

function tick(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('bailout（第 18 章：跳过重渲染）', () => {
  it('同层兄弟：A 更新时 B 不重渲染（childLanes 只沿祖先链上冒）', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let aRenders = 0;
    let bRenders = 0;
    let setA!: (v: number) => void;

    function A() {
      aRenders++;
      const [x, s] = useState(0);
      setA = s;
      return createElement('span', null, String(x));
    }
    function B() {
      bRenders++;
      return createElement('span', null, 'B');
    }
    function App() {
      return createElement('div', null, createElement(A), createElement(B));
    }

    createRoot(container).render(createElement(App));
    expect(aRenders).toBe(1);
    expect(bRenders).toBe(1);

    flushSync(() => setA(1));
    expect(container.textContent).toBe('1B');
    expect(aRenders).toBe(2); // A 自己重渲染
    expect(bRenders).toBe(1); // B 整段跳过
  });

  it('整段跳过：B 的子孙也不被 beginWork 走到', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let aRenders = 0;
    let bRenders = 0;
    let cRenders = 0;
    let setA!: (v: number) => void;

    function A() {
      aRenders++;
      const [x, s] = useState(0);
      setA = s;
      return createElement('span', null, String(x));
    }
    function C() {
      cRenders++;
      return createElement('em', null, 'C');
    }
    function B() {
      bRenders++;
      return createElement('section', null, createElement(C));
    }
    function App() {
      return createElement('div', null, createElement(A), createElement(B));
    }

    createRoot(container).render(createElement(App));
    expect([bRenders, cRenders]).toEqual([1, 1]);

    flushSync(() => setA(2));
    expect(container.textContent).toBe('2C');
    expect([aRenders, bRenders, cRenders]).toEqual([2, 1, 1]); // B 及其子树 C 都没再跑
  });

  it('跳过 lane 重标记：transition 更新被 sync 渲染跳过，后续仍能落地', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let setChild!: (v: number) => void;
    let setParent!: (v: number) => void;
    let start!: (cb: () => void) => void;

    function Child() {
      const [v, s] = useState(0);
      setChild = s;
      return createElement('span', null, String(v));
    }
    function Parent() {
      const [n, s] = useState(0);
      setParent = s;
      const [_isPending, st] = useTransition();
      start = st;
      return createElement('div', null, createElement(Child), `n=${n}`);
    }

    createRoot(container).render(createElement(Parent));
    expect(container.textContent).toBe('0n=0'); // Child=0, Parent n=0

    // ① 给 Child 挂一条 transition 更新（低优先级，走并发，不立即渲染）
    start(() => setChild(1));
    await Promise.resolve();
    expect(container.textContent).toBe('0n=0');

    // ② 给 Parent 挂一条 sync 更新：sync 渲染会连带重渲染 Child，
    //    此时 Child 的 transition 更新被跳过（renderLanes 不含它）——必须被重新点回 lanes，
    //    否则随后的 transition 渲染会因「props 没变 + lanes 已清」把 Child 整段 bailout 掉、更新丢失。
    flushSync(() => setParent(5));
    expect(container.textContent).toBe('0n=5'); // Child 仍 0（transition 未消费）

    // ③ transition 渲染落地：Child 的 1 应被应用
    await tick();
    expect(container.textContent).toBe('1n=5');
  });
});