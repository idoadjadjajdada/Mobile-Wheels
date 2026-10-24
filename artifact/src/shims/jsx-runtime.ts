// Automatic JSX runtime on top of React 18's UMD createElement (props.children is passed through as-is).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = (window as any).React;
type Props = Record<string, unknown>;
export const Fragment = R.Fragment;
export function jsx(type: unknown, props: Props, key?: string) {
  return R.createElement(type, key === undefined ? props : { ...props, key });
}
export const jsxs = jsx;
export const jsxDEV = jsx;
