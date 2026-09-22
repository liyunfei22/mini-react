// playground 入口：从第 4 章起用真正的 renderer（createRoot）渲染，取代第 1 章的手写 mini-render。
import { createRoot } from '@mini-react/react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root 容器不存在');
}

createRoot(rootElement).render(<App />);
