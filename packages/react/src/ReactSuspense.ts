// 对应官方 packages/react/src/React.js 里 `REACT_SUSPENSE_TYPE as Suspense`。
// Suspense 本身就是一个 Symbol（与 Fragment 同理）：react 只产出 element（type 是这个 symbol），
// 渲染时由 react-reconciler 的 createFiberFromTypeAndProps 识别并映射成 SuspenseComponent 这个 tag。
import { REACT_SUSPENSE_TYPE } from '@mini-react/shared';

export const Suspense: symbol = REACT_SUSPENSE_TYPE;