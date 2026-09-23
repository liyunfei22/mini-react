import { describe, expect, it } from 'vitest';
import {
  createContainer,
  flushSyncCallbacks,
  initializeHostConfig,
  updateContainer,
} from '../index';
import type { HostConfig } from '../index';

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
    // 关键：遵 DOM 语义——appendChild/insertBefore 会把"已存在的节点"从原位置移走再放（不是裸 push），
    // 否则移动场景（Placement on 复用节点）会残留重复节点。这也是 why diff.test 才暴露、mount 阶段无感。
    appendChild: (parent, child) => {
      const children = (parent as TestElement).children;
      const existing = children.indexOf(child as TestNode);
      if (existing >= 0) children.splice(existing, 1);
      children.push(child as TestNode);
      ops.push('appendChild');
    },
    appendChildToContainer: (container, child) => {
      const children = (container as unknown as TestElement).children;
      const existing = children.indexOf(child as TestNode);
      if (existing >= 0) children.splice(existing, 1);
      children.push(child as TestNode);
      ops.push('appendChildToContainer');
    },
    insertBefore: (parent, child, before) => {
      const children = (parent as TestElement).children;
      const existing = children.indexOf(child as TestNode);
      if (existing >= 0) children.splice(existing, 1);
      const i = children.indexOf(before as TestNode);
      children.splice(i < 0 ? children.length : i, 0, child as TestNode);
      ops.push('insertBefore');
    },
    removeChild: (parent, child) => {
      const children = (parent as TestElement).children;
      const existing = children.indexOf(child as TestNode);
      if (existing >= 0) children.splice(existing, 1);
      ops.push('removeChild');
    },
    removeChildFromContainer: (container, child) => {
      const children = (container as unknown as TestElement).children;
      children.splice(children.indexOf(child as TestNode), 1);
      ops.push('removeChildFromContainer');
    },
    prepareUpdate: () => null,
    commitUpdate: (instance, payload) => {
      const node = instance as TestElement;
      const p = payload as unknown[];
      for (let i = 0; i < p.length; i += 2) node.props[p[i] as string] = p[i + 1];
    },
    commitTextUpdate: (textInstance, _old, newText) => {
      (textInstance as TestText).text = String(newText);
    },
    getPublicInstance: (instance) => instance,
  };
}

initializeHostConfig(makeHost());

const REACT_ELEMENT_TYPE = Symbol.for('react.element');
function el(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
  const { key = null, ...rest } = props ?? {};
  const nextProps: Record<string, unknown> = { ...rest };
  if (children.length === 1) nextProps.children = children[0];
  else if (children.length > 1) nextProps.children = children;
  return { $$typeof: REACT_ELEMENT_TYPE, type, key: key as null | string, props: nextProps };
}

function renderList(root: ReturnType<typeof createContainer>, keys: string[]) {
  updateContainer(
    el(
      'ul',
      null,
      keys.map((k) => el('li', { key: k }, k.toUpperCase())),
    ),
    root,
  );
  flushSyncCallbacks();
}
function liTexts(container: { children: TestNode[] }): (string | undefined)[] {
  const ul = container.children[0] as TestElement;
  return ul.children.map((c) => ((c as TestElement).children[0] as TestText | undefined)?.text);
}

describe('数组 diff：key 复用 / 移动 / 增删', () => {
  it('keyed 重排 [a,b,c] → [c,a,b]：复用节点 + 整体后移（appendChild 移动）', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);

    renderList(root, ['a', 'b', 'c']);
    const ul = container.children[0] as TestElement;
    const [a0, b0, c0] = ul.children as [TestElement, TestElement, TestElement];
    ops.length = 0;

    renderList(root, ['c', 'a', 'b']);
    const [c1, a1, b1] = ul.children as [TestElement, TestElement, TestElement];

    // 顺序 c,a,b
    expect(liTexts(container)).toEqual(['C', 'A', 'B']);
    // 复用：三个节点身份没变
    expect(c1).toBe(c0);
    expect(a1).toBe(a0);
    expect(b1).toBe(b0);
  });

  it('keyed 交换 [a,b,c] → [b,a,c]：插中间走 insertBefore', () => {
    ops.length = 0;
    const container = { children: [] };
    const root = createContainer(container);

    renderList(root, ['a', 'b', 'c']);
    ops.length = 0;

    renderList(root, ['b', 'a', 'c']);
    expect(liTexts(container)).toEqual(['B', 'A', 'C']);
    // 插到已提交兄弟（c）之前，需要 insertBefore
    expect(ops).toContain('insertBefore');
  });

  it('keyed 追加 [a,b] → [a,b,c]：复用前两个，新增第三个', () => {
    const container = { children: [] };
    const root = createContainer(container);

    renderList(root, ['a', 'b']);
    const ul = container.children[0] as TestElement;
    const [a0, b0] = ul.children;
    ops.length = 0;

    renderList(root, ['a', 'b', 'c']);
    expect(liTexts(container)).toEqual(['A', 'B', 'C']);
    expect(ul.children[0]).toBe(a0); // 复用
    expect(ul.children[1]).toBe(b0);
    expect(ops).not.toContain('removeChildFromContainer'); // 没删
  });

  it('keyed 删除 [a,b,c] → [a,c]：b 删除，a/c 复用', () => {
    const container = { children: [] };
    const root = createContainer(container);

    renderList(root, ['a', 'b', 'c']);
    const ul = container.children[0] as TestElement;
    const [a0, , c0] = ul.children;
    ops.length = 0;

    renderList(root, ['a', 'c']);
    expect(liTexts(container)).toEqual(['A', 'C']);
    expect(ul.children[0]).toBe(a0);
    expect(ul.children[1]).toBe(c0);
    expect(ops).toContain('removeChild'); // 从 ul 里删 b
  });

  it('无 key：按 index 复用，文本更新不重建', () => {
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(el('ul', null, [el('li', null, 'x'), el('li', null, 'y')]), root);
    flushSyncCallbacks();
    const ul = container.children[0] as TestElement;
    const [li0, li1] = ul.children;

    updateContainer(el('ul', null, [el('li', null, 'X'), el('li', null, 'Y')]), root);
    flushSyncCallbacks();

    // 同一节点实例，文本改
    expect(ul.children[0]).toBe(li0);
    expect(ul.children[1]).toBe(li1);
    expect(liTexts(container)).toEqual(['X', 'Y']);
  });

  it('key 相同但 type 变化：旧删除、新创建（不复用）', () => {
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(el('ul', null, [el('li', { key: 'k' }, 'a')]), root);
    flushSyncCallbacks();
    const ul = container.children[0] as TestElement;
    const before = ul.children[0];

    updateContainer(el('ul', null, [el('div', { key: 'k' }, 'a')]), root);
    flushSyncCallbacks();

    expect(ul.children[0]).not.toBe(before); // 新实例
    expect((ul.children[0] as TestElement).type).toBe('div');
  });

  it('Fragment 直接展开子节点（不产生分组 DOM）', () => {
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(
      el(Symbol.for('react.fragment'), null, el('span', null, 'a'), el('span', null, 'b')),
      root,
    );
    flushSyncCallbacks();

    // Fragment 无 DOM，两个 span 直接挂到容器
    expect(container.children).toHaveLength(2);
    expect((container.children[0] as TestElement).type).toBe('span');
    expect((container.children[1] as TestElement).type).toBe('span');
  });
});
