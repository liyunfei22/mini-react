import { afterEach, describe, expect, it } from 'vitest';
import {
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  unstable_cancelCallback,
  unstable_scheduleCallback,
  unstable_shouldYield,
} from '../index';

// Scheduler 用 MessageChannel 驱动，任务在 macrotask 里执行；tick 让出主线程等它跑完
function tick(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Scheduler', () => {
  afterEach(async () => {
    await tick(20); // 等消息循环彻底空转，避免跨用例污染
  });

  it('按优先级顺序执行任务（高优先级先跑）', async () => {
    const log: string[] = [];
    unstable_scheduleCallback(LowPriority, () => log.push('low'));
    unstable_scheduleCallback(NormalPriority, () => log.push('normal'));
    unstable_scheduleCallback(ImmediatePriority, () => log.push('immediate'));
    await tick();
    expect(log).toEqual(['immediate', 'normal', 'low']);
  });

  it('delay 任务在到点前不执行', async () => {
    const log: string[] = [];
    unstable_scheduleCallback(NormalPriority, () => log.push('now'));
    unstable_scheduleCallback(NormalPriority, () => log.push('later'), { delay: 40 });
    await tick(10);
    expect(log).toEqual(['now']); // later 还没到点
    await tick(60);
    expect(log).toEqual(['now', 'later']);
  });

  it('cancelCallback 取消任务', async () => {
    const log: string[] = [];
    const task = unstable_scheduleCallback(NormalPriority, () => log.push('cancelled'));
    unstable_cancelCallback(task);
    await tick();
    expect(log).toEqual([]);
  });

  it('回调返回函数 → 作为 continuation 继续执行', async () => {
    const log: string[] = [];
    unstable_scheduleCallback(NormalPriority, () => {
      log.push('first');
      return () => {
        log.push('second');
        return undefined;
      };
    });
    await tick();
    expect(log).toEqual(['first', 'second']);
  });

  it('工作循环内占用超过 5ms 帧预算后 shouldYield 变 true', async () => {
    let yieldedWithinTask = false;
    unstable_scheduleCallback(NormalPriority, () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 8) {
        // 忙等 8ms > 5ms 预算
      }
      yieldedWithinTask = unstable_shouldYield();
    });
    await tick();
    expect(yieldedWithinTask).toBe(true);
  });
});
