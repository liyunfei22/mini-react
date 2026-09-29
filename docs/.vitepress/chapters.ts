// 本文件由 tools/sync-docs.mjs 生成，勿手改。
export interface ChapterItem {
  text: string;
  link: string;
}

export const chaptersSidebar: ChapterItem[] = [
  {
    "text": "0 · 为什么读 React 源码，以及这套专栏要带你做什么",
    "link": "/chapters/00-系列导读"
  },
  {
    "text": "1 · React 是怎么打包的——还原 scripts/rollup 式构建脚手架",
    "link": "/chapters/01-从零搭建React式构建脚手架"
  },
  {
    "text": "2 · createElement 与 JSX 运行时——虚拟 DOM 的诞生",
    "link": "/chapters/02-createElement与JSX运行时"
  },
  {
    "text": "3 · Fiber 数据结构——为什么 React 用链表代替递归，以及双缓冲的妙处",
    "link": "/chapters/03-fiber-data-structure"
  },
  {
    "text": "4 · 首屏挂载——递归渲染如何变成一趟可遍历的 Fiber 游标",
    "link": "/chapters/04-mount"
  },
  {
    "text": "5 · commit 三阶段——为什么要在 Mutation 之后、Layout 之前换树",
    "link": "/chapters/05-commit"
  },
  {
    "text": "6 · useState 为什么只是个\"读 dispatcher 的函数\"——hooks 运行时拆解",
    "link": "/chapters/06-hooks"
  },
  {
    "text": "7 · setState 之后的调度——requestUpdateLane 与 ensureRootIsScheduled",
    "link": "/chapters/07-scheduling"
  },
  {
    "text": "8 · Diff 的 key 心智模型——lastPlacedIndex 如何判断\"复用\"还是\"移动\"",
    "link": "/chapters/08-reconciliation"
  },
  {
    "text": "9 · useEffect/useLayoutEffect——副作用链表与两种提交时机",
    "link": "/chapters/09-effects"
  },
  {
    "text": "10 · useMemo/useCallback/useRef——三个 hook，一种套路",
    "link": "/chapters/10-memo-callback-ref"
  },
  {
    "text": "11 · Context 的 valueCursor——值如何沿 Fiber 树入栈出栈",
    "link": "/chapters/11-context"
  },
  {
    "text": "12 · ref 与 forwardRef——attachRef 为什么在布局阶段而不是挂在 DOM 那一步",
    "link": "/chapters/12-refs"
  },
  {
    "text": "13 · 合成事件系统——为什么 React 不在每个 DOM 上绑事件",
    "link": "/chapters/13-events"
  },
  {
    "text": "14 · Scheduler——5ms 一片的时间切片是怎么切出来的",
    "link": "/chapters/14-scheduler"
  },
  {
    "text": "15 · Lane 模型——优先级怎么编码进一个 31 位数里",
    "link": "/chapters/15-lanes"
  },
  {
    "text": "16 · 并发渲染——把 Scheduler、Lane、useTransition 接成一台可中断的机器",
    "link": "/chapters/16-concurrent"
  },
  {
    "text": "17 · 收官——把 17 个零件装回一张地图（全链复盘）",
    "link": "/chapters/17-retrospective"
  },
  {
    "text": "18 · bailout——父组件重渲染时，没变的子树凭什么可以跳过",
    "link": "/chapters/18-bailout"
  },
  {
    "text": "19 · Suspense——child 抛一个 thenable，边界怎么优雅地「挂起」",
    "link": "/chapters/19-suspense"
  }
];
