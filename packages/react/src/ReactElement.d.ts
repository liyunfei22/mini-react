export declare const REACT_ELEMENT_TYPE: symbol;
export declare const REACT_FRAGMENT_TYPE: symbol;
export type ReactKey = string | null;
export type ReactNode = ReactElement | String | number | boolean | null | undefined | ReactNode[];
/** props 的默认形状：允许任意属性名 + 保留 children 位 */
export type ElementProps = {
    [propName: string]: unknown;
    children?: ReactNode;
};
export interface ReactElement<Type = unknown, Props extends object = ElementProps> {
    $$typeof: symbol;
    type: Type;
    key: ReactKey;
    ref: unknown;
    props: Props;
    _owner: unknown;
    _store: {
        validated: boolean;
    };
    /** dev 专用：当前组件自引用 */
    _self?: unknown;
    /** dev 专用：JSX 编译时源码位置 */
    _source?: unknown;
}
/** createElement / jsx 的 config 形状 */
export interface ElementConfig {
    key?: ReactKey;
    ref?: unknown;
    __self?: unknown;
    __source?: unknown;
    [propName: string]: unknown;
}
/** dev 下校验 type：只允许内置标签(string)/函数/符号(如 Fragment) */
export declare function validateElementType(type: unknown, source: string | null): void;
/**
 * ReactElement 工厂 —— 官方同名函数。
 * 注意：所有真实 DOM / 组件渲染逻辑都在 react-reconciler（第 4 章起），
 * 这里只负责"造一个分布式的描述对象"。
 */
export declare function ReactElement<Type = unknown>(type: Type, key: ReactKey, ref: unknown, self: unknown, source: unknown, owner: unknown, props: Record<string, unknown>): ReactElement<Type>;
/**
 * createElement —— 对应官方 && React.createElement。
 * 经典模式三参起：createElement(type, config, ...children)。
 */
export declare function createElement<Type>(type: Type, config?: ElementConfig | null, ...children: unknown[]): ReactElement<Type>;
/**
 * isValidElement —— 判断对象是不是 ReactElement。
 * 官方实现：typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE
 */
export declare function isValidElement(object: unknown): object is ReactElement;
export declare const Fragment: symbol;
//# sourceMappingURL=ReactElement.d.ts.map