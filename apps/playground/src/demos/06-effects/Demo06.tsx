import { useEffect, useState } from '@mini-react/react';

/**
 * 06 · useEffect：时钟与 cleanup。
 * effect 挂载一个 setInterval，cleanup（return 的函数）里 clearInterval——
 * 只在依赖变化或卸载时才触发 cleanup 的语义一目了然。
 */
export function Demo06() {
  const [now, setNow] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id); // cleanup：卸载 / 依赖变化时先跑
  }, []);

  return (
    <section className="demo-card">
      <h2>09 · useEffect：时钟 + cleanup</h2>
      <p>
        当前时间：<strong>{now}</strong>
      </p>
      <p>effect 在 paint 之后异步执行；cleanup 在下次 effect 之前（或卸载时）先跑。</p>
    </section>
  );
}
