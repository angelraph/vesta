"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { lock, signOut } from "@/lib/account";
import { useSession } from "@/lib/hooks";
import { useHome } from "@/lib/house";
import { loadHouseKey, readNotes, recreateInvite, short, writeNotes, type HouseNote } from "@/lib/vault";
import { Avatar, Button, Card, Header, Notice, useAction } from "@/components/ui";

export default function HousePage() {
  const s = useSession();
  const { view, houseIds, current, pick } = useHome(s);
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [houseKey, setHouseKey] = useState<CryptoKey | null>(null);
  const [notes, setNotes] = useState<HouseNote[] | null>(null);
  const [draft, setDraft] = useState<HouseNote>({ label: "", value: "" });
  const save = useAction();
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    if (!s || !view) return;
    let live = true;
    (async () => {
      try {
        const [link, key] = await Promise.all([recreateInvite(s, view.house), loadHouseKey(s, view.house)]);
        if (!live) return;
        setInvite(link);
        setHouseKey(key);
        if (key) setNotes((await readNotes(view.house.id, key)).items);
      } catch {
        if (live) setNotesError("Couldn't open the house notes with this passkey.");
      }
    })();
    return () => {
      live = false;
    };
  }, [s, view?.house.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;

  async function share() {
    if (!invite) return;
    const text = `Join ${view?.house.name} on Vesta`;
    if (navigator.share) {
      await navigator.share({ title: "Vesta", text, url: invite }).catch(() => null);
    } else {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function addNote() {
    if (!s || !view || !houseKey || !notes || !draft.label.trim()) return;
    const next = [...notes, { label: draft.label.trim(), value: draft.value.trim() }];
    await save.run(async () => {
      await writeNotes(s, view.house.id, houseKey, { items: next });
      setNotes(next);
      setDraft({ label: "", value: "" });
    });
  }

  async function removeNote(i: number) {
    if (!s || !view || !houseKey || !notes) return;
    const next = notes.filter((_, j) => j !== i);
    await save.run(async () => {
      await writeNotes(s, view.house.id, houseKey, { items: next });
      setNotes(next);
    });
  }

  return (
    <div className="space-y-5">
      <Header
        title={view?.house.name ?? "House"}
        action={
          <Link href="/house/new" className="rounded-full px-3 py-1.5 text-sm font-semibold text-hearth hover:bg-leaf">
            New house
          </Link>
        }
      />

      {houseIds.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {houseIds.map((id) => (
            <button
              key={id.toString()}
              onClick={() => pick(id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${id === current ? "border-hearth bg-hearth text-cream" : "border-line bg-paper"}`}
            >
              House {id.toString()}
            </button>
          ))}
        </div>
      ) : null}

      {view ? (
        <>
          <Card>
            <h2 className="font-display text-xl font-semibold">Who lives here</h2>
            <ul className="mt-3 divide-y divide-line">
              {view.members.map((m) => (
                <li key={m.address} className="flex items-center gap-3 py-2.5">
                  <Avatar name={m.name} />
                  <div className="flex-1">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted">{short(m.address)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="ember" className="mt-4 w-full" disabled={!invite} onClick={share}>
              {copied ? "Link copied" : "Invite a housemate"}
            </Button>
            <p className="mt-2 text-xs text-muted">
              The invite link carries the house key. Send it privately, the way you&apos;d share a door code.
            </p>
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-semibold">House notes</h2>
              <p className="mt-1 text-sm text-muted">
                Wifi password, the landlord&apos;s number, who has the spare key. Locked with the house key, so only people who live here can read them.
              </p>
            </div>
            {notesError ? <Notice tone="error">{notesError}</Notice> : null}
            {notes === null && !notesError ? <p className="text-sm text-muted">Unlocking…</p> : null}
            {notes?.length ? (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">{n.label}</p>
                      <p className="mt-0.5 break-all">{n.value}</p>
                    </div>
                    <button onClick={() => removeNote(i)} className="text-xs text-muted hover:text-danger" aria-label={`Remove ${n.label}`}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {notes ? (
              <div className="grid gap-2">
                <input
                  placeholder="Label, e.g. Wifi"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  className="h-11 rounded-xl border border-line px-3 text-[16px] outline-none focus:border-hearth"
                />
                <input
                  placeholder="Value"
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                  className="h-11 rounded-xl border border-line px-3 text-[16px] outline-none focus:border-hearth"
                />
                <Button variant="ghost" busy={save.busy} disabled={!draft.label.trim()} onClick={addNote}>
                  Save note
                </Button>
                {save.error ? <Notice tone="error">{save.error}</Notice> : null}
              </div>
            ) : null}
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-muted">You&apos;re not in a house yet.</p>
          <Link href="/house/new">
            <Button className="mt-4 w-full">Set up a house</Button>
          </Link>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">You</h2>
        <div className="rounded-2xl bg-cream px-4 py-3">
          <p className="text-xs text-muted">Your Vesta address. Share it to get paid.</p>
          <button
            className="num mt-1 break-all text-left text-sm"
            onClick={() => navigator.clipboard.writeText(s.address)}
            title="Copy"
          >
            {s.address}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={lock}>
            Lock now
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
        <p className="text-xs text-muted">Signing out only forgets this phone. Your passkey brings everything back.</p>
      </Card>
    </div>
  );
}
