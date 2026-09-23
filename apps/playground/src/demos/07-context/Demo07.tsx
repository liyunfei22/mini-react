import { createContext, createElement, useContext, useState } from '@mini-react/react';

const Theme = createContext('light');

function Themed() {
  const theme = useContext(Theme);
  return (
    <p>
      当前主题：<strong>{theme}</strong>
    </p>
  );
}

/** 07 · Context：Provider + useContext 的主题切换 */
export function Demo07() {
  const [theme, setTheme] = useState('light');
  // Provider 是普通对象（不是函数组件），用 createElement 渲染而非 JSX
  return createElement(
    Theme.Provider,
    { value: theme },
    <section className="demo-card">
      <h2>11 · Context：主题切换</h2>
      <Themed />
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>切换主题</button>
      <p>Provider 用 pushProvider 改 _currentValue，子组件 useContext（readContext）读取。</p>
    </section>,
  );
}
