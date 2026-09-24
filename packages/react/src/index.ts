// @mini-react/react —— 用户侧 API（对应官方 packages/react/src/React.js 门面）。
// 第 1 章只交付 element 层；hooks/context/ref/memo 等按路线图在后续章节加入。
export {
  createElement,
  isValidElement,
  Fragment,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
} from './ReactElement';

export type {
  ElementConfig,
  ElementProps,
  ReactElement,
  ReactKey,
  ReactNode,
} from './ReactElement';

export { ReactCurrentOwner } from './ReactCurrentOwner';

// hooks（第 6 章交付 useState/useReducer；其余入口已就位，运行时按章节逐个实现）
export {
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from './ReactHooks';

export { createContext } from './ReactContext';
export { createRef } from './ReactCreateRef';
export { forwardRef } from './ReactForwardRef';

// 内部单例：react-dom 的 dist 从这里拿 ReactSharedInternals（hooks 章节开始使用）。
// 命名对齐官方 __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED。
export {
  ReactSharedInternals,
  default as __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
} from './ReactSharedInternals';
