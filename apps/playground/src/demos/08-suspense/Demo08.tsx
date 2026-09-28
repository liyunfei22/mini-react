import { Suspense, createElement, useState } from '@mini-react/react';

/**
 * 一个「未就绪就 throw thenable、就绪就返回数据」的资源（对齐 React 19 `use(promise)` 心智模型）。
 * Suspense 就靠接住这个被抛出的 promise 来「挂起」（第 19 章）。
 */
interface Resource {
  read(): string;
}

function createResource(): Resource {
  let resolved: string | null = null;
  let promise: Promise<void> | null = null;
  return {
    read() {
      if (resolved !== null) return resolved;
      if (promise === null) {
        promise = new Promise<void>((res) => {
          setTimeout(() => {
            resolved = `数据已加载（${new Date().toLocaleTimeString()}）`;
            res();
          }, 800);
        });
      }
      throw promise; // 未就绪：抛 thenable → 边界挂起
    },
  };
}

function Content({ resource }: { resource: Resource }) {
  return <p>内容：{resource.read()}</p>;
}

/** 08 · Suspense：挂起 → fallback → promise resolve 后切回 primary */
export function Demo08() {
  const [resource, setResource] = useState<Resource | null>(null);
  const load = () => setResource(createResource());
  return (
    <section className="demo-card">
      <h2>19 · Suspense：挂起与唤醒</h2>
      <button onClick={load}>加载数据（挂起 800ms）</button>
      {resource === null ? (
        <p>尚未加载</p>
      ) : (
        // Suspense 是 Symbol（非函数组件，与 Provider 同理），用 createElement 渲染
        createElement(
          Suspense,
          { fallback: createElement('p', null, 'loading…') },
          createElement(Content, { resource }),
        )
      )}
      <p>点按钮：Content 的 read() 抛 promise → 边界 markRootSuspended → 渲染 fallback；resolve 后 wake 再渲染 primary。</p>
    </section>
  );
}