// 第 1 章的"手写渲染器"：把 element 树变成真实 DOM，让你看得见 createElement 的产物。
//
// ⚠️ 这不是最终方案 —— 第 4 章会用 Fiber + commit 阶段替换它。
// 它刻意保持"纯递归"，方便和"Fiber 迭代 + 可中断"两种心智模型做对比（文章里会讲）。
import type { ReactElement } from '@mini-react/react';

export function renderElement(element: ReactElement): Node {
  const { type, props } = element;

  if (typeof type === 'string') {
    // 1) 内置标签：建节点 + 应用 props（只挑常见字段做示范）
    const node = document.createElement(type);
    for (const key in props) {
      const value = props[key];
      if (key === 'children') continue;
      if (key === 'className') {
        node.className = String(value);
      } else if (key === 'style' && value && typeof value === 'object') {
        Object.assign((node as HTMLElement).style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (value != null) {
        node.setAttribute(key, String(value));
      }
    }
    // 2) children → 子节点
    appendChildren(node, props.children);
    return node;
  }

  // 函数组件 / Fragment 需要 reconciler（第 3~4 章），这里给出醒目提示而不是偷偷渲染错
  throw new Error(
    `[mini-render] 第 1 章只支持 DOM 标签（string type），收到：${Object.prototype.toString.call(type)}`,
  );
}

/** 把一棵 element 树渲染进容器（replaceChildren 保证幂等重入） */
export function renderRoot(element: ReactElement, container: HTMLElement): void {
  container.replaceChildren(renderElement(element));
}

function appendChildren(parent: HTMLElement, children: unknown): void {
  if (children == null || typeof children === 'boolean') {
    return;
  }
  if (Array.isArray(children)) {
    for (const child of children) {
      appendChild(parent, child);
    }
  } else {
    appendChild(parent, children);
  }
}

function appendChild(parent: HTMLElement, child: unknown): void {
  if (typeof child === 'string' || typeof child === 'number') {
    parent.appendChild(document.createTextNode(String(child)));
  } else if (
    typeof child === 'object' &&
    child !== null &&
    (child as { $$typeof?: unknown }).$$typeof != null
  ) {
    parent.appendChild(renderElement(child as ReactElement));
  }
  // null / undefined / boolean 是合法的"空 children"，直接忽略
}
