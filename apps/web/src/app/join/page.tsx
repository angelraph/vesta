"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createAccount, unlock, type Unlocked } from "@/lib/account";
import { useAccount, useMounted } from "@/lib/hooks";
import { getHouse, getMembers, joinHouse, parseInvite, setName, type House } from "@/lib/vault";
import { Mark } from "@/components/Logo";
import { Avatar, Button, Field, Notice, useAction } from "@/components/ui";
import { BrowserCheck, PasskeyFinish } from "@/components/PasskeyHelp";

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export default function Join() {
  const account = useAccount();
  const router = useRouter();
  const mounted = useMounted();
  // The invite lives after the #, so it never reaches a server.
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const invite = useMemo(() => parseInvite(hash), [hash]);
  const [house, setHouse] = useState<House | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [name, setNameInput] = useState("");
  const { busy, error, run } = useAction();
  const bad = failed || (mounted && !invite && !house);

  useEffect(() => {
    if (!invite) return;
    Promise.all([getHouse(invite.houseId), getMembers(invite.houseId)])
      .then(([h, m]) => {
        if (h.creator === "0x0000000000000000000000000000000000000000") throw new Error("no house");
        setHouse(h);
        setPeople(m.members.map((x) => x.name));
      })
      .catch(() => setFailed(true));
  }, [invite]);

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
      await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: s.address }),
      }).catch(() => null);
      await setName(s, name.trim());
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
        <h1 className="mt-6 text-[28px] font-extrabold tracking-tight">This invite doesn&apos;t work</h1>
        <p className="mt-2 text-ink-2">Ask your housemate to send the link again from the House tab.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <Mark size={56} animated />
        <p className="mt-8 text-[13px] font-bold uppercase tracking-wide text-ember">You&apos;re invited</p>
        <h1 className="mt-2 font-display text-[38px] font-semibold leading-tight tracking-tight">{house ? house.name : "Opening invite…"}</h1>
        {people.length ? (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-2">
              {people.slice(0, 4).map((p) => (
                <span key={p} className="rounded-full ring-2 ring-bg">
                  <Avatar name={p} size={32} />
                </span>
              ))}
            </div>
            <p className="text-[14px] text-ink-2">{people.join(", ")} already live here</p>
          </div>
        ) : null}

        <PasskeyFinish />
        <div className="mt-10 space-y-3">
          <BrowserCheck />
          {account.status === "signedOut" ? (
            <>
              <Field label="Your name" placeholder="Tobi" value={name} maxLength={32} onChange={(e) => setNameInput(e.target.value)} />
              <Button className="w-full" busy={busy} disabled={!house || name.trim().length < 2} onClick={onNew}>
                Move in with a passkey
              </Button>
              <Button variant="secondary" className="w-full" disabled={!house} onClick={onExisting}>
                I already use Vesta
              </Button>
            </>
          ) : (
            <Button className="w-full" busy={busy} disabled={!house} onClick={onExisting}>
              Move into {house?.name ?? "the house"}
            </Button>
          )}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </div>
    </main>
  );
}
