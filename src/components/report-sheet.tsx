"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { Sheet } from "./sheet";
import { Button } from "./states";
import { useToast } from "./toast";

const KINDS = [
  ["hours", "Hours are wrong"],
  ["price", "Price is wrong"],
  ["closed", "Permanently closed"],
  ["delivery", "Delivery info is wrong"],
  ["menu", "Item isn't on the menu"],
  ["other", "Something else"],
] as const;

export function ReportSheet({ open, onClose, restaurantId, menuItemId }: { open: boolean; onClose: () => void; restaurantId?: string; menuItemId?: string }) {
  const { show } = useToast();
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("hours");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.report({ restaurantId, menuItemId, kind, message: message || undefined });
      show({ message: "Thanks — an admin will review it." });
      onClose();
      setMessage("");
    } catch {
      show({ message: "Couldn't send the report. Try again later." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Report wrong info">
      <div className="grid grid-cols-2 gap-2">
        {KINDS.map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`rounded-xl px-3 py-2.5 text-left text-sm ${kind === k ? "ember-bg text-white" : "glass text-dust"}`}>
            {label}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm text-dust">
        Details (optional)
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} className="glass mt-1.5 w-full rounded-xl p-3 text-bone outline-none" placeholder="e.g. Closes at 10 PM on Sundays now" />
      </label>
      <Button onClick={submit} disabled={busy} className="mt-4 w-full">
        {busy ? "Sending…" : "Send report"}
      </Button>
    </Sheet>
  );
}
