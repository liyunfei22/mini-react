// playground 入口：用第 1 章的 mini-render 把 element 树渲染进 #root。
import { App } from './App';
import { renderRoot } from './mini-render';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root 容器不存在');
}

renderRoot(App(), root);
