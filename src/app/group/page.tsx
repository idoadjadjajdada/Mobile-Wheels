"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/shell";
import { Button } from "@/components/states";
import { useRequireSetup } from "@/components/use-setup";
import { api, ApiError } from "@/lib/client/api";
import { setGroup, useStore } from "@/lib/client/store";

export default function GroupHome() {
  useRequireSetup();
  const router = useRouter();
  const group = useStore((s) => s.group);
  const memberId = useStore((s) => s.memberId);
  const location = useStore((s) => s.profile.location);
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("Dinner crew");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createGroup({ name: groupName, memberId, displayName: name, center: location?.point });
      setGroup({ code: res.code, memberId, displayName: name });
      router.push(`/group/${res.code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create group");
    } finally {
      setBusy(false);
    }
  };
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.joinGroup(code.trim().toUpperCase(), { memberId, displayName: name });
      setGroup({ code: res.code, memberId, displayName: name });
      router.push(`/group/${res.code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't join group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell header={<PageHeader title="Group mode" />}>
      <div className="space-y-6 px-4">
        <div className="glass rounded-3xl p-5">
          <Users className="h-8 w-8 text-ember" />
          <h2 className="mt-3 font-display text-2xl font-semibold leading-tight">Can&apos;t agree? Swipe separately.</h2>
          <p className="mt-2 text-sm text-dust">Everyone swipes on their own phone. CRAVE shows the meals — and restaurants — that everyone liked. Groups expire after 2 days.</p>
        </div>

        {group && (
          <Link href={`/group/${group.code}`} className="ember-bg block rounded-2xl p-4 text-center font-semibold text-white">
            Back to your group · {group.code}
          </Link>
        )}

        <label className="block text-sm text-dust">
          Your name (shown to the group)
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Sam" className="glass mt-1.5 w-full rounded-xl px-3 py-3 text-bone outline-none" />
        </label>

        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold">Start a group</h3>
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={60} aria-label="Group name" className="glass w-full rounded-xl px-3 py-3 outline-none" />
          <Button className="w-full" disabled={!name.trim() || busy} onClick={create}>Create & get a code</Button>
        </section>

        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold">Join with a code</h3>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123" aria-label="Group code" className="glass w-full rounded-xl px-3 py-3 font-mono text-lg tracking-[0.3em] outline-none" />
          <Button variant="outline" className="w-full" disabled={!name.trim() || code.length !== 6 || busy} onClick={join}>Join group</Button>
        </section>
        {error && <p className="text-sm text-flame" role="alert">{error}</p>}
      </div>
    </AppShell>
  );
}
