import { TriangleAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon, title, body, children }: { icon?: ReactNode; title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      {icon && <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-white/5 text-ember">{icon}</div>}
      <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
      {body && <div className="mt-2 text-sm leading-relaxed text-dust">{body}</div>}
      {children && <div className="mt-6 flex w-full flex-col gap-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, offline }: { message: string; onRetry?: () => void; offline?: boolean }) {
  return (
    <EmptyState
      icon={offline ? <WifiOff className="h-7 w-7" /> : <TriangleAlert className="h-7 w-7" />}
      title={offline ? "You're offline" : "That didn't load"}
      body={message}
    >
      {onRetry && (
        <button onClick={onRetry} className="ember-bg rounded-2xl px-5 py-3 text-sm font-semibold text-white active:scale-[0.98]">
          Try again
        </button>
      )}
    </EmptyState>
  );
}

export function DeckSkeleton() {
  return (
    <div className="relative mx-auto aspect-[3/4.4] w-full max-w-[420px]" aria-busy="true" aria-label="Loading meals">
      <div className="skeleton absolute inset-x-6 top-3 bottom-0 rounded-[28px] opacity-40" />
      <div className="skeleton absolute inset-0 rounded-[28px]" />
      <div className="absolute inset-x-6 bottom-8 space-y-3">
        <div className="h-8 w-2/3 rounded-lg bg-white/10" />
        <div className="h-4 w-1/2 rounded bg-white/10" />
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger" }) {
  const styles = {
    primary: "ember-bg text-white shadow-[0_10px_30px_-10px] shadow-ember/60",
    ghost: "bg-white/6 text-bone hover:bg-white/10",
    outline: "border border-white/15 text-bone hover:bg-white/5",
    danger: "bg-flame/12 text-flame hover:bg-flame/20",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
