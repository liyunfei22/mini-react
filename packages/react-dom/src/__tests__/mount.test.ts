// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement } from '@mini-react/react';
import { createRoot } from '../index';

describe('react-dom 首屏挂载（真实 DOM）', () => {
  it('createRoot().render 把元素渲染进容器', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;

    const root = createRoot(container);
    root.render(
      createElement('h1', { className: 'title' }, 'Hello', createElement('span', null, ' World')),
    );

    const h1 = container.querySelector('h1.title');
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBe('Hello World');
    expect(h1!.querySelector('span')?.textContent).toBe(' World');
  });

  it('属性落位：className / style / 事件', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let clicked = 0;

    createRoot(container).render(
      createElement(
        'button',
        { className: 'btn', style: { color: 'red' }, onClick: () => clicked++ },
        '点我',
      ),
    );

    const btn = container.querySelector<HTMLButtonElement>('button.btn')!;
    expect(btn.getAttribute('style')).toContain('color: red');
    btn.click();
    expect(clicked).toBe(1);
  });
});
