// playground 入口：真正的 renderer（createRoot）。
import { createRoot } from '@mini-react/react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root 容器不存在');
}

createRoot(rootElement).render(<App />);
