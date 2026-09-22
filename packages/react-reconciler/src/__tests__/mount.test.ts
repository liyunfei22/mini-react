import { describe, expect, it } from 'vitest';
import {
  createContainer,
  flushSyncCallbacks,
  initializeHostConfig,
  updateContainer,
} from '../index';
import type { HostConfig } from '../index';

// ---- 内存 host：模拟 DOM 的最小对象模型（reconciler 单测不碰真实 DOM）----
interface TestElement {
  type: string;
  props: Record<string, unknown>;
  children: (TestElement | TestText)[];
}
interface TestText {
  text: string;
}
type TestNode = TestElement | TestText;

function makeHost(): HostConfig {
  return {
    getRootHostContext: () => null,
    getChildHostContext: () => null,
    shouldSetTextContent: () => false,
    createInstance: (type, props) => ({ type, props, children: [] }),
    createTextInstance: (text) => ({ text }),
    appendInitialChild: (parent, child) => (parent as TestElement).children.push(child as TestNode),
    appendChild: (parent, child) => (parent as TestElement).children.push(child as TestNode),
    appendChildToContainer: (container, child) =>
      (container as unknown as TestElement).children.push(child as TestNode),
    insertBefore: (parent, child, before) => {
      const children = (parent as TestElement).children;
      const i = children.indexOf(before as TestNode);
      children.splice(i < 0 ? children.length : i, 0, child as TestNode);
    },
    removeChild: (parent, child) => {
      const children = (parent as TestElement).children;
      children.splice(children.indexOf(child as TestNode), 1);
    },
    removeChildFromContainer: (container, child) => {
      const children = (container as unknown as TestElement).children;
      children.splice(children.indexOf(child as TestNode), 1);
    },
    prepareUpdate: () => null,
    commitUpdate: () => {},
    commitTextUpdate: () => {},
    getPublicInstance: (instance) => instance,
  };
}

// 本测试文件只注入一次 host（模块级），reconciler 单例在一个文件里共享
initializeHostConfig(makeHost());

// ---- 裸 element 构造器（reconciler 测试刻意不 import react，保持 renderer 无关）----
const REACT_ELEMENT_TYPE = Symbol.for('react.element');

function element(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
  const { key = null, ...rest } = props ?? {};
  const nextProps: Record<string, unknown> = { ...rest };
  if (children.length === 1) {
    nextProps.children = children[0];
  } else if (children.length > 1) {
    nextProps.children = children;
  }
  return { $$typeof: REACT_ELEMENT_TYPE, type, key: key as null | string, props: nextProps };
}

describe('首屏挂载：element 树 → 实例树', () => {
  it('函数组件 + host 元素整链挂载', () => {
    const container = { children: [] };
    const root = createContainer(container);

    function App(props: { msg: string }) {
      return element('div', { className: 'app' }, element('span', null, props.msg));
    }

    updateContainer(element(App, { msg: 'hi' }), root);
    flushSyncCallbacks();

    const div = container.children[0] as TestElement;
    expect(div.type).toBe('div');
    // 注意：children 是 props 的一部分（React 不变式），所以这里的 props 也含 children
    expect(div.props.className).toBe('app');
    expect(div.children).toHaveLength(1);

    const span = div.children[0] as TestElement;
    expect(span.type).toBe('span');
    expect((span.children[0] as TestText).text).toBe('hi');
  });

  it('多子元素按 key 顺序生成 sibling 链', () => {
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(
      element(
        'ul',
        null,
        element('li', { key: 'a' }, 'first'),
        element('li', { key: 'b' }, 'second'),
        element('li', { key: 'c' }, 'third'),
      ),
      root,
    );
    flushSyncCallbacks();

    const list = container.children[0] as TestElement;
    expect(list.type).toBe('ul');
    // key 是 fiber 的元数据，不落在 props 上（这正是"用 key 复用节点却不污染 props"的关键）
    expect(list.children).toHaveLength(3);
    expect(list.children.map((c) => ((c as TestElement).children[0] as TestText).text)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('数字归一化为文本节点', () => {
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer(element('p', null, 1, 2, 3), root);
    flushSyncCallbacks();

    const p = container.children[0] as TestElement;
    expect(p.children).toHaveLength(3);
    expect((p.children[0] as TestText).text).toBe('1');
    expect((p.children[2] as TestText).text).toBe('3');
  });

  it('commit 后 root.current 切到成品树、finishedWork 清空', () => {
    const root = createContainer({ children: [] });
    const emptyRootFiber = root.current;

    updateContainer(element('div', null, 'x'), root);
    flushSyncCallbacks();

    expect(root.current).not.toBe(emptyRootFiber);
    expect(root.current.child).not.toBeNull();
    expect(root.finishedWork).toBeNull();
  });

  it('顶层数组 root：每个子节点都打 Placement 并全部挂载', () => {
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer([element('li', null, 'a'), element('li', null, 'b')], root);
    flushSyncCallbacks();

    expect(container.children).toHaveLength(2);
    expect((container.children[0] as TestElement).type).toBe('li');
    expect((container.children[1] as TestElement).type).toBe('li');
  });

  it('顶层文本/数字 root：打 Placement 并挂载为文本节点', () => {
    const container = { children: [] };
    const root = createContainer(container);

    updateContainer('hello', root);
    flushSyncCallbacks();

    expect(container.children).toHaveLength(1);
    expect((container.children[0] as TestText).text).toBe('hello');
  });
});
