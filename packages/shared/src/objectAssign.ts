// 对应官方 shared/assign.js：Object.assign 的最小封装。
// 学习点：官方在低版本环境需要 polyfill，现代浏览器原生都有。

const assign: typeof Object.assign = Object.assign;

export { assign as objectAssign };
export default assign;
