// DOM 的 HostConfig 实现 —— 对应官方 packages/react-dom/src/client/ReactDOMHostConfig.js。
// reconciler 只认这 14 个方法（见 packages/react-reconciler/src/HostConfig.ts），
// 本文件把"抽象操作"落成真实 DOM API，这是 renderer 与核心引擎的分界。
import type { HostConfig, Props } from '@mini-react/react-reconciler';

/** onXxx → DOM 事件名（只修 multi-word 与缩写不一致的；第 13 章合成事件系统会整体替换这层） */
function eventNameFromProp(propKey: string): string {
  const name = propKey.slice(2).toLowerCase();
  if (name === 'doubleclick') return 'dblclick';
  return name;
}

/** 无需加 px 单位的 CSS 属性（数值型 style 值要对非 unitless 补 'px'） */
const unitlessStyleProps = new Set([
  'opacity',
  'zIndex',
  'fontWeight',
  'lineHeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'order',
  'zoom',
  'scale',
  'counterIncrement',
  'counterReset',
  'aspectRatio',
]);

function applyStyle(node: HTMLElement, style: Record<string, string | number>): void {
  for (const key in style) {
    const value = style[key];
    if (typeof value === 'number' && !unitlessStyleProps.has(key)) {
      (node.style as unknown as Record<string, string>)[key] = `${value}px`;
    } else {
      (node.style as unknown as Record<string, string | number>)[key] = value;
    }
  }
}

/** 应用一组 props 到 DOM 节点（初建与 commitUpdate 共用） */
function setPropsToNode(node: HTMLElement, props: Props): void {
  for (const key in props) {
    const value = props[key];
    if (key === 'children') continue;

    if (key === 'className') {
      node.className = String(value);
    } else if (key === 'style' && value && typeof value === 'object') {
      applyStyle(node, value as Record<string, string | number>);
    } else if (key.startsWith('on') && typeof value === 'function') {
      // 第 13 章合成事件系统里换成根委托；第 4 章先直接 addEventListener
      node.addEventListener(eventNameFromProp(key), value as EventListener);
    } else if (typeof value === 'boolean') {
      // 布尔属性：true 设空串，false 移除（checked / disabled 等）
      if (value) node.setAttribute(key, '');
      else node.removeAttribute(key);
    } else if (value != null) {
      node.setAttribute(key, String(value));
    } else {
      node.removeAttribute(key);
    }
  }
}

export const ReactDOMHostConfig: HostConfig = {
  getRootHostContext: () => null,
  getChildHostContext: () => null,
  // 官方 isDirectTextChild：文本子节点可不建子 fiber（第 5 章使用）
  shouldSetTextContent: (_type, props) =>
    typeof props.children === 'string' || typeof props.children === 'number',

  createInstance(type, props) {
    const instance = document.createElement(type);
    if (props) {
      setPropsToNode(instance, props);
    }
    return instance;
  },
  createTextInstance(text) {
    return document.createTextNode(text);
  },
  appendInitialChild(parentInstance, child) {
    (parentInstance as Node).appendChild(child as Node);
  },
  appendChild(parentInstance, child) {
    (parentInstance as Node).appendChild(child as Node);
  },
  appendChildToContainer(container, child) {
    (container as Node).appendChild(child as Node);
  },
  insertBefore(parentInstance, child, before) {
    (parentInstance as Node).insertBefore(child as Node, before as Node | null);
  },
  removeChild(parentInstance, child) {
    (parentInstance as Node).removeChild(child as Node);
  },
  removeChildFromContainer(container, child) {
    (container as Node).removeChild(child as Node);
  },
  commitUpdate(instance, _oldProps, newProps) {
    setPropsToNode(instance as HTMLElement, newProps);
  },
  commitTextUpdate(textInstance, _oldText, newText) {
    (textInstance as Text).nodeValue = newText;
  },
  getPublicInstance(instance) {
    return instance;
  },
};
