import { describe, expect, it } from 'vitest';
import {
  createContainer,
  flushSyncCallbacks,
  initializeHostConfig,
  updateContainer,
} from '../index';
import type { HostConfig } from '../index';

// ---- 可记录操作顺序的内存 host（单例，模块级注入一次）----
interface TestElement {
  type: string;
  props: Record<string, unknown>;
  children: (TestElement | TestText)[];
}
interface TestText {
  text: string;
}
type TestNode = TestElement | TestText;

const ops: string[] = [];

function makeHost(): HostConfig {
  return {
    getRootHostContext: () => null,
    getChildHostContext: () => null,
    shouldSetTextContent: () => false,
    createInstance: (type, props) => ({ type, props, children: [] }),
    createTextInstance: (text) => ({ text }),
    appendInitialChild: (parent, child) => (parent as TestElement).children.push(child as TestNode),
    appendChild: (parent, child) => {
      (parent as TestElement).children.push(child as TestNode);
      ops.push('appendChild');
    },
    appendChildToContainer: (container, child) => {
      (container as unknown as TestElement).children.push(child as TestNode);
      ops.push('appendChildToContainer');
    },
    insertBefore: (parent, child, before) => {
      const children = (parent as TestElement).children;
      const i = children.indexOf(before as TestNode);
      children.splice(i < 0 ? children.length : i, 0, child as TestNode);
      ops.push('insertBefore');
    },
    removeChild: (parent, child) => {
      const children = (parent as TestElement).children;
      children.splice(children.indexOf(child as TestNode), 1);
      ops.push('removeChild');
    },
    removeChildFromContainer: (container, child) => {
      const children = (container as unknown as TestElement).children;
      children.splice(children.indexOf(child as TestNode), 1);
      ops.push('removeChildFromContainer');
    },
    prepareUpdate: (_instance, _type, oldProps, newProps) => {
      // 内存 host 的 props diff（只覆盖本文件用到的 className 等普通属性）
      const updates: unknown[] = [];
      for (const key of new Set([...Object.keys(oldProps), ...Object.keys(newProps)])) {
        if (key === 'children' || oldProps[key] === newProps[key]) continue;
        updates.push(key, newProps[key] ?? null);
      }
      return updates.length > 0 ? updates : null;
    },
    commitUpdate: (instance, payload) => {
      const node = instance as TestElement;
      const p = payload as unknown[];
      for (let i = 0; i < p.length; i += 2) {
        node.props[p[i] as string] = p[i + 1];
      }
      ops.push(`commitUpdate:${node.type}`);
    },
    commitTextUpdate: (textInstance, _oldText, newText) => {
      (textInstance as TestText).text = String(newText);
      ops.push(`commitTextUpdate:${String(newText)}`);
    },
    getPublicInstance: (instance) => instance,
  };
}

// 本文件只注入一次 host；ops 由各测试自行清空
initializeHostConfig(makeHost());

const REACT_ELEMENT_TYPE = Symbol.for('react.element');
function el(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
  const { key = null, ...rest } = props ?? {};
  const nextProps: Record<string, unknown> = { ...rest };
  if (children.length === 1) nextProps.children = children[0];
  else if (children.length > 1) nextProps.children = children;
  return { $$typeof: REACT_ELEMENT_TYPE, type, key: key as null | string, props: nextProps };
}

describe('调度：ensureRootIsScheduled / callbackNode 复用', () => {
  it('同一批次多次 updateContainer 只渲染一次（同 lane 不重复调度）', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);
    let renders = 0;

    function App() {
      renders++;
      return el('div', null, 'x');
    }

    updateContainer(el(App, null), root);
    updateContainer(el(App, null), root); // 同 SyncLane，flush 前
    updateContainer(el(App, null), root);
    flushSyncCallbacks();

    // callbackNode 复用 → 只调度一次 → 渲染一次
    expect(renders).toBe(1);
  });

  it('flush 后 callback 复位，再次调度仍能渲染', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);
    let renders = 0;

    function App() {
      renders++;
      return el('div', null, String(renders));
    }

    updateContainer(el(App, null), root);
    flushSyncCallbacks();
    expect(renders).toBe(1);

    updateContainer(el(App, null), root);
    flushSyncCallbacks();
    expect(renders).toBe(2);
  });
});

describe('提交阶段：更新 / 删除 / 顺序', () => {
  it('类型变化：先删旧、再插新（mutation 内部 order）', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(el('div', null, 'x'), root);
    flushSyncCallbacks();
    ops.length = 0;

    updateContainer(el('span', null, 'y'), root);
    flushSyncCallbacks();

    // 删除在 placement 之前
    expect(ops).toEqual(['removeChildFromContainer', 'appendChildToContainer']);
    expect((container.children[0] as TestElement).type).toBe('span');
  });

  it('同类型更新：复用节点，走 commitUpdate 而非重建', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(el('div', { className: 'a' }, 'x'), root);
    flushSyncCallbacks();
    const before = container.children[0];
    ops.length = 0;

    updateContainer(el('div', { className: 'b' }, 'y'), root);
    flushSyncCallbacks();

    expect(container.children[0]).toBe(before); // 同一节点实例
    expect(ops).toContain('commitUpdate:div');
    expect(ops).not.toContain('appendChildToContainer');
    expect(ops).not.toContain('removeChildFromContainer');
  });

  it('渲染 null：删除整棵旧树', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(el('div', null, 'x'), root);
    flushSyncCallbacks();
    expect(container.children).toHaveLength(1);

    updateContainer(null, root);
    flushSyncCallbacks();

    expect(container.children).toHaveLength(0);
    expect(ops).toContain('removeChildFromContainer');
    expect(root.current.child).toBeNull();
  });

  it('文本更新：替换内容不重复建节点', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(el('p', null, 'hello'), root);
    flushSyncCallbacks();
    ops.length = 0;

    updateContainer(el('p', null, 'world'), root);
    flushSyncCallbacks();

    const p = container.children[0] as TestElement;
    expect(p.children).toHaveLength(1);
    expect((p.children[0] as TestText).text).toBe('world');
    expect(ops).toContain('commitTextUpdate:world');
    expect(ops).not.toContain('appendChildToContainer');
  });

  it('数组更新：删旧建新，不残留重复 DOM', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(el('ul', null, [el('li', null, 'a'), el('li', null, 'b')]), root);
    flushSyncCallbacks();
    expect((container.children[0] as TestElement).children).toHaveLength(2);

    updateContainer(
      el('ul', null, [el('li', null, 'a'), el('li', null, 'b'), el('li', null, 'c')]),
      root,
    );
    flushSyncCallbacks();

    // 关键：应是 3 个 li，而不是 2（残留）+ 3（新建）= 5
    expect((container.children[0] as TestElement).children).toHaveLength(3);
  });
});
