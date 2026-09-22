// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement } from '@mini-react/react';
import { createRoot } from '../index';

describe('react-dom 更新 / 删除（真实 DOM）', () => {
  it('同一容器二次 render：更新属性而非重建节点', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const root = createRoot(container);

    root.render(createElement('div', { className: 'box', title: 'a' }, 'hi'));
    const box = container.querySelector('div.box')!;

    root.render(createElement('div', { className: 'box', title: 'b' }, 'hi'));
    const box2 = container.querySelector('div.box')!;

    expect(box2).toBe(box); // 同一节点实例（复用）
    expect(box2.getAttribute('title')).toBe('b');
    expect(container.children).toHaveLength(1);
  });

  it('render(null) 清空容器', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const root = createRoot(container);

    root.render(createElement('p', null, 'x'));
    expect(container.children).toHaveLength(1);

    root.render(null);
    expect(container.children).toHaveLength(0);
  });

  it('文本内容更新', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const root = createRoot(container);

    root.render(createElement('p', null, 'hello'));
    root.render(createElement('p', null, 'world'));
    expect(container.querySelector('p')!.textContent).toBe('world');
  });
});
