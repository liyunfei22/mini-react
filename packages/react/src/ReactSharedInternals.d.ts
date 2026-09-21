import type { Dispatcher, Transition } from '@mini-react/shared';
interface ReactSharedInternalsShape {
    ReactCurrentDispatcher: {
        current: Dispatcher | null;
    };
    ReactCurrentBatchConfig: {
        transition: Transition | null;
    };
}
export declare const ReactSharedInternals: ReactSharedInternalsShape;
export default ReactSharedInternals;
//# sourceMappingURL=ReactSharedInternals.d.ts.map