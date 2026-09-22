import { describe, expect, it } from 'vitest';
import {
  ConcurrentRoot,
  HostComponent,
  HostRoot,
  HostText,
  NoFlags,
  NoLanes,
  Placement,
  RefStatic,
  createContainer,
  createFiber,
  createHostRootFiber,
  createWorkInProgress,
  formatFiberTree,
  getHighestPriorityLane,
  isSubsetOfLanes,
} from '../index';

import { ConcurrentMode } from '../index';

describe('createFiber —— FiberNode 默认字段形状', () => {
  it('构造后各字段回到"空"默认态', () => {
    const fiber = createFiber(HostComponent, { id: 'x' }, null, ConcurrentMode);

    // Identity
    expect(fiber.tag).toBe(HostComponent);
    expect(fiber.key).toBeNull();

    // 静态信息默认 null
    expect(fiber.elementType).toBeNull();
    expect(fiber.type).toBeNull();
    expect(fiber.stateNode).toBeNull();

    // 树结构默认 null / 0
    expect(fiber.return).toBeNull();
    expect(fiber.child).toBeNull();
    expect(fiber.sibling).toBeNull();
    expect(fiber.index).toBe(0);
    expect(fiber.ref).toBeNull();

    // 渲染数据
    expect(fiber.pendingProps).toEqual({ id: 'x' });
    expect(fiber.memoizedProps).toBeNull();
    expect(fiber.memoizedState).toBeNull();
    expect(fiber.updateQueue).toBeNull();
    expect(fiber.dependencies).toBeNull();

    // 调度与副作用
    expect(fiber.mode).toBe(ConcurrentMode);
    expect(fiber.flags).toBe(NoFlags);
    expect(fiber.subtreeFlags).toBe(NoFlags);
    expect(fiber.deletions).toBeNull();
    expect(fiber.lanes).toBe(NoLanes);
    expect(fiber.childLanes).toBe(NoLanes);
    expect(fiber.alternate).toBeNull();
  });
});

describe('createHostRootFiber / createFiberRoot —— 树的根', () => {
  it('host root fiber 的 tag 是 HostRoot、mode 是并发模式', () => {
    const rootFiber = createHostRootFiber();
    expect(rootFiber.tag).toBe(HostRoot);
    expect(rootFiber.mode).toBe(ConcurrentMode);
  });

  it('createFiberRoot 双向指认 root 与 fiber', () => {
    const container = { rootId: 'app' };
    const root = createContainer(container);

    expect(root.tag).toBe(ConcurrentRoot);
    expect(root.containerInfo).toBe(container);
    expect(root.current.tag).toBe(HostRoot);
    // FiberRoot.current ←→ HostRoot.stateNode 的双向引用
    expect(root.current.stateNode).toBe(root);
    expect(root.pendingLanes).toBe(NoLanes);
    expect(root.finishedWork).toBeNull();
  });
});

describe('createWorkInProgress —— 双缓冲', () => {
  it('首次调用：新建并与 current 互为 alternate', () => {
    const current = createHostRootFiber();
    const wip = createWorkInProgress(current, null);

    expect(wip).not.toBe(current);
    expect(wip.alternate).toBe(current);
    expect(current.alternate).toBe(wip);
    // 静态信息从 current 拷贝
    expect(wip.tag).toBe(current.tag);
    expect(wip.stateNode).toBe(current.stateNode);
  });

  it('复用调用：返回同一个 wip 对象（不反复 new）', () => {
    const current = createHostRootFiber();
    const first = createWorkInProgress(current, null);
    const second = createWorkInProgress(current, { a: 1 });

    expect(second).toBe(first); // identity 稳定 → 无 GC 压力
    expect(second.pendingProps).toEqual({ a: 1 });
  });

  it('动态 effect flag 在每轮重置；静态 static flag 保留', () => {
    const current = createHostRootFiber();
    current.flags = Placement | RefStatic; // 一个 effect flag + 一个 static flag

    const wip = createWorkInProgress(current, null);
    // Placement 是 effect flag（动态）→ 重置掉；RefStatic 在 StaticMask 里 → 保留
    expect(wip.flags).toBe(RefStatic);
  });

  it('子树蓄 flag 与 deletions 每轮清空', () => {
    const current = createHostRootFiber();
    current.subtreeFlags = Placement;
    current.deletions = [createFiber(HostText, null, null, ConcurrentMode)];

    const wip = createWorkInProgress(current, null);
    expect(wip.subtreeFlags).toBe(NoFlags);
    expect(wip.deletions).toBeNull();
  });

  it('ping-pong：commit 交换 current 后，下一轮 wip 复用旧的 current', () => {
    const root = createContainer({});
    const current = root.current;

    // 第一次渲染：从 current 造出 wip
    const wip = createWorkInProgress(current, null);
    expect(wip.alternate).toBe(current);

    // 模拟 commit：把成品树指针换过去（第 5 章会真的这么做）
    root.current = wip;

    // 第二次渲染：从"新的 current"再造 wip → 复用的是上一次的 current（互换）
    const wip2 = createWorkInProgress(root.current, null);
    expect(wip2).toBe(current);
    expect(root.current.alternate).toBe(current);
  });
});

describe('lane 工具（第 3 章最小集）', () => {
  it('getHighestPriorityLane 取最低位的 1', () => {
    expect(getHighestPriorityLane(0b100)).toBe(0b100);
    expect(getHighestPriorityLane(0b1100)).toBe(0b100);
    expect(getHighestPriorityLane(NoLanes)).toBe(NoLanes);
  });

  it('isSubsetOfLanes 判断子集', () => {
    expect(isSubsetOfLanes(0b111, 0b010)).toBe(true);
    expect(isSubsetOfLanes(0b010, 0b111)).toBe(false);
  });
});

describe('formatFiberTree —— 调试打印', () => {
  it('缩进输出树结构', () => {
    const root = createContainer({}).current;
    const div = createFiber(HostComponent, null, 'container', ConcurrentMode);
    div.elementType = 'div';
    div.type = 'div';
    const text = createFiber(HostText, null, null, ConcurrentMode);
    text.type = 'hello';

    root.child = div;
    div.return = root;
    div.child = text;
    text.return = div;

    const output = formatFiberTree(root);
    const lines = output.split('\n');
    expect(lines[0]).toContain('HostRoot');
    expect(lines[1]).toContain('HostComponent');
    expect(lines[1]).toContain('`div`');
    expect(lines[1]).toContain('key="container"');
    expect(lines[2]).toContain('HostText');
  });
});
