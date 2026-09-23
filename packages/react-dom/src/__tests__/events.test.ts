// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement } from '@mini-react/react';
import {
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  getEventPriority,
} from '../events/DOMEventSystem';
import { createRoot } from '../index';

describe('合成事件系统', () => {
  it('根委托：onClick 通过容器上的一个监听器派发', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    let clicked = 0;

    createRoot(container).render(
      createElement('button', { onClick: () => (clicked += 1) }, '点我'),
    );

    container.querySelector('button')!.click();
    expect(clicked).toBe(1);
  });

  it('冒泡顺序：子先触发、父后触发', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const log: string[] = [];

    createRoot(container).render(
      createElement(
        'div',
        { onClick: () => log.push('parent') },
        createElement('button', { onClick: () => log.push('child') }, 'x'),
      ),
    );

    container.querySelector('button')!.click();
    expect(log).toEqual(['child', 'parent']);
  });

  it('stopPropagation 阻止父级 handler', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const log: string[] = [];

    createRoot(container).render(
      createElement(
        'div',
        { onClick: () => log.push('parent') },
        createElement(
          'button',
          {
            onClick: (e: { stopPropagation(): void }) => {
              log.push('child');
              e.stopPropagation();
            },
          },
          'x',
        ),
      ),
    );

    container.querySelector('button')!.click();
    expect(log).toEqual(['child']);
  });

  it('捕获阶段 onClickCapture 先于冒泡 onClick', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app')!;
    const log: string[] = [];

    createRoot(container).render(
      createElement(
        'div',
        {
          onClickCapture: () => log.push('capture'),
          onClick: () => log.push('bubble'),
        },
        createElement('button', null, 'x'),
      ),
    );

    container.querySelector('button')!.click();
    expect(log).toEqual(['capture', 'bubble']);
  });

  it('事件优先级映射：click 离散 / mousemove 连续 / load 默认', () => {
    expect(getEventPriority('click')).toBe(DiscreteEventPriority);
    expect(getEventPriority('mousemove')).toBe(ContinuousEventPriority);
    expect(getEventPriority('load')).toBe(DefaultEventPriority);
  });
});
