// 对应官方 packages/react/src/ReactForwardRef.js。
// forwardRef 把 render 塞进一个带 $$typeof 的对象；reconciler 命中 ForwardRef tag 时，
// 用 (props, ref) 两参调用它里的 render，ref 就得以穿过函数组件直达内部 DOM。
import { REACT_FORWARD_REF_TYPE } from '@mini-react/shared';

export function forwardRef<P, T>(
  render: (props: P, ref: T) => unknown,
): { $$typeof: symbol; render: (props: P, ref: T) => unknown } {
  return {
    $$typeof: REACT_FORWARD_REF_TYPE,
    render,
  };
}
