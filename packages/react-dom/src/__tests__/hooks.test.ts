// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement, useReducer, useState } from '@mini-react/react';
import { flushSyncCallbacks } from '@mini-react/react-reconciler';
import { createRoot } from '../index';

describe('useState / useReducer 运行时', () => {
  it('计数器：dispatch 触发 re-render 并更新 DOM', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let setCount!: (action: number | ((c: number) => number)) => void;

    function Counter() {
      const [count, set] = useState(0);
      setCount = set;
      return createElement('div', null, String(count));
    }

    createRoot(container).render(createElement(Counter));
    expect(container.querySelector('div')!.textContent).toBe('0');

    setCount((c) => c + 1);
    flushSyncCallbacks();
    expect(container.querySelector('div')!.textContent).toBe('1');
  });

  it('同一批次内的多次 dispatch 合并为一次渲染', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let renders = 0;
    let setCount!: (action: number | ((c: number) => number)) => void;

    function Counter() {
      renders++;
      const [count, set] = useState(0);
      setCount = set;
      return createElement('div', null, String(count));
    }

    createRoot(container).render(createElement(Counter));
    renders = 0;

    // 连续三次函数式更新，flush 前都在同一个 queue 里 → 只 render 一次，结果 3
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    flushSyncCallbacks();

    expect(renders).toBe(1);
    expect(container.querySelector('div')!.textContent).toBe('3');
  });

  it('Object.is bailout：设相同值不触发 re-render', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let renders = 0;
    let setCount!: (v: number) => void;

    function Counter() {
      renders++;
      const [count, set] = useState(0);
      setCount = set;
      return createElement('div', null, String(count));
    }

    createRoot(container).render(createElement(Counter));
    renders = 0;

    setCount(0); // 与当前一致 → eager bailout，不调度
    flushSyncCallbacks();
    expect(renders).toBe(0);
  });

  it('多个 useState 相互独立', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let setA!: (v: number) => void;
    let setB!: (v: string) => void;

    function Pair() {
      const [a, sa] = useState(0);
      const [b, sb] = useState('x');
      setA = sa;
      setB = sb;
      return createElement('div', null, `${a}:${b}`);
    }

    createRoot(container).render(createElement(Pair));
    setA(1);
    flushSyncCallbacks();
    expect(container.querySelector('div')!.textContent).toBe('1:x');

    setB('y');
    flushSyncCallbacks();
    expect(container.querySelector('div')!.textContent).toBe('1:y');
  });

  it('hook 顺序错乱（渲染更多 hook）抛出错误', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    function Bad({ showSecond }: { showSecond: boolean }) {
      useState('a');
      if (showSecond) {
        useState('b');
      }
      return createElement('div', null, 'x');
    }

    const root = createRoot(container);
    root.render(createElement(Bad, { showSecond: false })); // 1 个 hook

    // 第二次变成 2 个 hook → updateWorkInProgressHook 抛 "Rendered more hooks"
    expect(() => root.render(createElement(Bad, { showSecond: true }))).toThrow(
      /Rendered more hooks/,
    );
  });

  it('useReducer：dispatch(action) 走自定义 reducer', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let dispatch!: (a: { type: string; by?: number }) => void;

    function reducer(state: number, action: { type: string; by?: number }) {
      return action.type === 'inc' ? state + (action.by ?? 1) : state - (action.by ?? 1);
    }

    function Counter() {
      const [count, d] = useReducer(reducer, 10);
      dispatch = d;
      return createElement('div', null, String(count));
    }

    createRoot(container).render(createElement(Counter));
    expect(container.querySelector('div')!.textContent).toBe('10');

    dispatch({ type: 'inc', by: 5 });
    flushSyncCallbacks();
    expect(container.querySelector('div')!.textContent).toBe('15');
  });

  it('渲染期 dispatch 抛错而非静默丢更新', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    function Bad() {
      const [v, setV] = useState(0);
      setV(1); // 在组件 body 里同步 setState → 渲染期 dispatch
      return createElement('div', null, String(v));
    }

    expect(() => createRoot(container).render(createElement(Bad))).toThrow(
      /Cannot update a component while rendering/,
    );
  });

  it('渲染抛错后 pendingLanes 复位，root 仍可合法再用', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    function Bad({ showSecond }: { showSecond: boolean }) {
      useState('a');
      if (showSecond) useState('b');
      return createElement('div', null, 'x');
    }
    function Good() {
      return createElement('div', null, 'ok');
    }

    const root = createRoot(container);
    root.render(createElement(Bad, { showSecond: false }));
    expect(() => root.render(createElement(Bad, { showSecond: true }))).toThrow(
      /Rendered more hooks/,
    );

    // 抛错后必须能继续正常渲染
    root.render(createElement(Good));
    expect(container.querySelector('div')!.textContent).toBe('ok');
  });
});
