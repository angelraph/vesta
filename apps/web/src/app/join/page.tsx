"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createAccount, unlock, type Unlocked } from "@/lib/account";
import { useAccount } from "@/lib/hooks";
import { getHouse, getMembers, joinHouse, parseInvite, setName, type House } from "@/lib/vault";
import { Mark } from "@/components/Logo";
import { Avatar, Button, Field, Notice, useAction } from "@/components/ui";

export default function Join() {
  const account = useAccount();
  const router = useRouter();
  const [invite, setInvite] = useState<ReturnType<typeof parseInvite>>(null);
  const [house, setHouse] = useState<House | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [bad, setBad] = useState(false);
  const [name, setNameInput] = useState("");
  const { busy, error, run } = useAction();

  useEffect(() => {
    const inv = parseInvite(window.location.hash);
    if (!inv) return setBad(true);
    setInvite(inv);
    Promise.all([getHouse(inv.houseId), getMembers(inv.houseId)])
      .then(([h, m]) => {
        setHouse(h);
        setPeople(m.members.map((x) => x.name));
      })
      .catch(() => setBad(true));
  }, []);

  async function finish(s: Unlocked) {
    if (!invite) return;
    const members = await getMembers(invite.houseId);
    if (!members.members.some((m) => m.address.toLowerCase() === s.address.toLowerCase())) {
      await joinHouse(s, invite);
    }
    try {
      localStorage.setItem("vesta.house", invite.houseId.toString());
    } catch {}
    // Drop the key from the address bar once it's safely stored.
    history.replaceState(null, "", "/join");
    router.replace("/home");
  }

  const onNew = () =>
    run(async () => {
      const s = await createAccount(name.trim());
      await setName(s, name.trim());
      await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: s.address }),
      }).catch(() => null);
      await finish(s);
    });

  const onExisting = () =>
    run(async () => {
      const s = account.status === "unlocked" ? account.session : await unlock();
      await finish(s);
    });

  if (bad) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <Mark size={52} />
        <h1 className="mt-6 font-display text-3xl font-semibold">This invite doesn&apos;t work</h1>
        <p className="mt-2 text-muted">Ask your housemate to send the link again from the House tab.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <Mark size={56} animated />
        <p className="mt-8 text-sm font-medium uppercase tracking-wide text-ember">You&apos;re invited</p>
        <h1 className="mt-2 font-display text-[36px] font-semibold leading-tight">{house ? house.name : "Opening invite…"}</h1>
        {people.length ? (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-2">
              {people.slice(0, 4).map((p) => (
                <span key={p} className="rounded-full ring-2 ring-cream">
                  <Avatar name={p} size={32} />
                </span>
              ))}
            </div>
            <p className="text-sm text-muted">{people.join(", ")} already live here</p>
          </div>
        ) : null}

        <div className="mt-10 space-y-3">
          {account.status === "signedOut" ? (
            <>
              <Field label="Your name" placeholder="Tobi" value={name} maxLength={32} onChange={(e) => setNameInput(e.target.value)} />
              <Button className="w-full" busy={busy} disabled={!house || name.trim().length < 2} onClick={onNew}>
                Join with a new passkey
              </Button>
              <Button variant="ghost" className="w-full" disabled={!house} onClick={onExisting}>
                I already use Vesta
              </Button>
            </>
          ) : (
            <Button className="w-full" busy={busy} disabled={!house} onClick={onExisting}>
              Join {house?.name ?? "house"}
            </Button>
          )}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </div>
    </main>
  );
}
