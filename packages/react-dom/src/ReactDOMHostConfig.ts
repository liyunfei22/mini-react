// DOM 的 HostConfig 实现 —— 对应官方 packages/react-dom/src/client/ReactDOMHostConfig.js。
// reconciler 只认这 14 个方法（见 packages/react-reconciler/src/HostConfig.ts），
// 本文件把"抽象操作"落成真实 DOM API，这是 renderer 与核心引擎的分界。
import type { HostConfig, Props } from '@mini-react/react-reconciler';
import { trackNodeProps } from './events/DOMEventSystem';

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

/** 应用一组 props 到 DOM 节点（初建用） */
function setPropsToNode(node: HTMLElement, props: Props): void {
  for (const key in props) {
    const value = props[key];
    if (key === 'children') continue;

    if (key === 'className') {
      node.className = String(value);
    } else if (key === 'style' && value && typeof value === 'object') {
      applyStyle(node, value as Record<string, string | number>);
    } else if (key.startsWith('on')) {
      // 事件走根委托（第 13 章合成事件系统），不在此绑定；props 已由 trackNodeProps 登记
      continue;
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

/**
 * 计算 props 差分 —— 官方 diffProperties 的 mini 版。
 * 返回扁平数组 [key1, value1, key2, value2, ...]；value 为 null 表示"删除该属性"。
 * 事件（onXxx）的更新暂不在此 diff（第 13 章用根委托事件系统统一处理）。
 */
function diffProperties(oldProps: Props, newProps: Props): unknown[] | null {
  const updates: unknown[] = [];
  const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  keys.delete('children');
  for (const key of keys) {
    const oldValue = oldProps[key];
    const newValue = newProps[key];
    if (oldValue === newValue) continue;
    updates.push(key, newValue == null ? null : newValue);
  }
  return updates.length > 0 ? updates : null;
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
      trackNodeProps(instance, props); // 登记，供事件委托派发查 onXxx
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
  prepareUpdate(_instance, _type, oldProps, newProps) {
    return diffProperties(oldProps, newProps);
  },
  commitUpdate(instance, updatePayload, _type, _oldProps, newProps) {
    const node = instance as HTMLElement;
    const payload = updatePayload as unknown[];
    for (let i = 0; i < payload.length; i += 2) {
      const key = payload[i] as string;
      const value = payload[i + 1];
      if (key.startsWith('on')) {
        continue; // 事件走委托，不直接落 DOM；下方 trackNodeProps 用 full newProps 更新
      }
      if (key === 'style') {
        if (value && typeof value === 'object') {
          applyStyle(node, value as Record<string, string | number>);
        } else {
          node.removeAttribute('style');
        }
      } else if (key === 'className') {
        node.className = String(value ?? '');
      } else if (value == null || value === false) {
        node.removeAttribute(key);
      } else if (typeof value === 'boolean') {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(value));
      }
    }
    trackNodeProps(node, newProps); // 更新节点的 handler 登记
  },
  commitTextUpdate(textInstance, _oldText, newText) {
    (textInstance as Text).nodeValue = newText;
  },
  getPublicInstance(instance) {
    return instance;
  },
};
