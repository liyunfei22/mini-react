// react 包对外的"内部单例"出口 —— 对应官方 __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED。
// 单例对象本身在 shared（注册于 globalThis，见 shared/src/ReactSharedInternals.ts），
// 这里只做转发，便于 react-dom 从 'react'（external）拉取同一份。
import { ReactSharedInternals } from '@mini-react/shared';

export { ReactSharedInternals };
export default ReactSharedInternals;