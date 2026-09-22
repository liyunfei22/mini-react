// playground 入口：真正的 renderer（createRoot）。
// 额外用 setInterval 每秒 re-render 一次 App —— 让"同 type/key 复用 + commitUpdate"肉眼可见，
// 几秒后 render(null) 演示 Deletion 清空容器。
import { createRoot } from '@mini-react/react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root 容器不存在');
}

const root = createRoot(rootElement);
let tick = 0;

function render() {
  root.render(<App tick={tick} />);
}

render();

const timer = setInterval(() => {
  tick += 1;
  if (tick > 5) {
    clearInterval(timer);
    root.render(null); // 演示 Deletion：清空整棵 DOM
    return;
  }
  render();
}, 1000);
