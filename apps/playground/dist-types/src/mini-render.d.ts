import type { ReactElement } from '@mini-react/react';
export declare function renderElement(element: ReactElement): Node;
/** 把一棵 element 树渲染进容器（replaceChildren 保证幂等重入） */
export declare function renderRoot(element: ReactElement, container: HTMLElement): void;
//# sourceMappingURL=mini-render.d.ts.map