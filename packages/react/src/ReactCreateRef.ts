// 对应官方 packages/react/src/ReactCreateRef.js。
// createRef 只是一个 { current: null } 盒子——ref 的值由 commit 阶段在 attachRef 时写入。
export function createRef<T>(): { current: T | null } {
  return { current: null };
}
