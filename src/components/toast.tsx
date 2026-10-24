"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastAction {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}
interface Toast {
  id: number;
  message: string;
  detail?: string;
  actions?: ToastAction[];
  duration?: number;
}

const Ctx = createContext<{ show: (t: Omit<Toast, "id">) => void; dismiss: () => void }>({ show: () => {}, dismiss: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((t: Omit<Toast, "id">) => {
    clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    timer.current = setTimeout(() => setToast(null), toast.duration ?? 3500);
    return () => clearTimeout(timer.current);
  }, [toast]);

  return (
    <Ctx.Provider value={{ show, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+var(--safe-bottom))] z-50 flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ y: 30, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass-strong pointer-events-auto w-full max-w-md rounded-2xl p-3 shadow-2xl"
              role="status"
            >
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.detail && <p className="mt-0.5 text-xs text-dust">{toast.detail}</p>}
              {toast.actions && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {toast.actions.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => {
                        a.onClick();
                        setToast(null);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                        a.tone === "danger" ? "bg-flame/15 text-flame hover:bg-flame/25" : "bg-white/8 text-bone hover:bg-white/14"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
