import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { navigate } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; replace?: boolean; prefetch?: boolean; scroll?: boolean; children?: ReactNode };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, replace, prefetch: _p, scroll: _s, onClick, children, ...rest }, ref) {
  return (
    <a
      ref={ref}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href, replace);
      }}
      {...rest}
    >
      {children}
    </a>
  );
});

export default Link;
