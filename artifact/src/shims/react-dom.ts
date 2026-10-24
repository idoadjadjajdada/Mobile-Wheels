// eslint-disable-next-line @typescript-eslint/no-explicit-any
const D = (window as any).ReactDOM;
export default D;
export const { createPortal, flushSync, findDOMNode, unstable_batchedUpdates } = D;
