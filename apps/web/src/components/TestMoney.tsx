"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { Unlocked } from "@/lib/account";
import { friendlyError } from "@/lib/account";
import { confirmTx } from "@/lib/vault";
import { Button, Notice } from "@/components/ui";

export const TEST_GRANT = 100;
export const TEST_CAP = 500;

/** Testnet only: draws $100 of test money from the Vesta pool. */
export function TestMoneyButton({ s, onDone, className = "w-full" }: { s: Unlocked; onDone?: () => void | Promise<void>; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: s.address }),
      });
      const out = (await res.json().catch(() => ({}))) as { hash?: `0x${string}`; error?: string };
      if (!res.ok || !out.hash) throw new Error(out.error || "Couldn't send test money right now. Try again in a minute.");
      await confirmTx(out.hash);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      await onDone?.();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button className={className} busy={busy} onClick={claim}>
        {done ? (
          <>
            <Check size={18} /> ${TEST_GRANT} added
          </>
        ) : (
          `Add $${TEST_GRANT} of test money`
        )}
      </Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
