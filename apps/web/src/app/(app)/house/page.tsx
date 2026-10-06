"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Lock, LogOut, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { lock, signOut } from "@/lib/account";
import { useSession } from "@/lib/hooks";
import { daysUntil, useHome } from "@/lib/house";
import { fromUnits, loadHouseKey, readNotes, recreateInvite, short, writeNotes, type HouseNote } from "@/lib/vault";
import { Avatar, Button, Card, Field, IconBubble, Money, Notice, PageTitle, Row, SectionTitle, Sheet, Skeleton, useAction } from "@/components/ui";

export default function HousePage() {
  const s = useSession();
  const { view, houseIds, current, pick, loading } = useHome(s);
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [houseKey, setHouseKey] = useState<CryptoKey | null>(null);
  const [notesFor, setNotesFor] = useState<{ id: string; items: HouseNote[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<HouseNote>({ label: "", value: "" });
  const [notesError, setNotesError] = useState<string | null>(null);
  const save = useAction();

  useEffect(() => {
    if (!s || !view) return;
    let live = true;
    const id = view.house.id.toString();
    (async () => {
      try {
        const [link, key] = await Promise.all([recreateInvite(s, view.house), loadHouseKey(s, view.house)]);
        if (!live) return;
        setInvite(link);
        setHouseKey(key);
        setNotesFor({ id, items: key ? (await readNotes(view.house.id, key)).items : [] });
      } catch {
        if (live) setNotesError("These notes are locked to a different passkey.");
      }
    })();
    return () => {
      live = false;
    };
  }, [s, view?.house.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;
  const notes = notesFor && view && notesFor.id === view.house.id.toString() ? notesFor.items : null;

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  }

  async function share() {
    if (!invite || !view) return;
    if (navigator.share) await navigator.share({ title: "Vesta", text: `Move into ${view.house.name} on Vesta`, url: invite }).catch(() => null);
    else copy(invite, "invite");
  }

  async function persist(next: HouseNote[]) {
    if (!view || !houseKey) return;
    await save.run(async () => {
      await writeNotes(s!, view.house.id, houseKey, { items: next });
      setNotesFor({ id: view.house.id.toString(), items: next });
      setAdding(false);
      setDraft({ label: "", value: "" });
    });
  }

  const days = view ? daysUntil(view.house.nextDue) : 0;

  return (
    <div className="space-y-6">
      <div className="pt-safe" />
      <div className="flex items-start justify-between px-1">
        <PageTitle sub={view ? `${view.members.length} ${view.members.length === 1 ? "person" : "people"} · rent ${days >= 0 ? `in ${days} days` : "overdue"}` : undefined}>
          {view?.house.name ?? (loading ? "…" : "House")}
        </PageTitle>
        <Link href="/house/new" className="mt-1 flex size-10 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_rgba(15,31,26,0.06)]" aria-label="New house">
          <Plus size={20} />
        </Link>
      </div>

      {houseIds.length > 1 ? (
        <div className="no-scrollbar -mt-3 flex gap-2 overflow-x-auto px-1">
          {houseIds.map((id) => (
            <button
              key={id.toString()}
              onClick={() => pick(id)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold ${id === current ? "bg-hearth text-white" : "bg-surface shadow-[0_0_0_1px_var(--line)]"}`}
            >
              House {id.toString()}
            </button>
          ))}
        </div>
      ) : null}

      {view ? (
        <>
          <div>
            <SectionTitle>People</SectionTitle>
            <Card pad={false} className="px-4 py-1">
              {view.members.map((m) => (
                <Row
                  key={m.address}
                  lead={<Avatar name={m.name} />}
                  title={m.address.toLowerCase() === s.address.toLowerCase() ? `${m.name} (you)` : m.name}
                  sub={m.address.toLowerCase() === view.house.creator.toLowerCase() ? "Set up the house" : "Housemate"}
                  trail={<Money value={fromUnits(view.sharePerMember)} cents={false} />}
                  trailSub="rent share"
                />
              ))}
              <Row
                lead={
                  <IconBubble tone="ember">
                    <UserPlus size={18} />
                  </IconBubble>
                }
                title={copied === "invite" ? "Invite link copied" : "Invite a housemate"}
                sub="Send the link privately, like a door code"
                onClick={share}
                chevron
              />
            </Card>
          </div>

          <div>
            <SectionTitle
              action={
                houseKey ? (
                  <button onClick={() => setAdding(true)} className="text-[13px] font-semibold text-hearth">
                    Add note
                  </button>
                ) : null
              }
            >
              House notes
            </SectionTitle>
            <Card pad={false} className="px-4 py-2">
              {notesError ? (
                <div className="py-2">
                  <Notice tone="error">{notesError}</Notice>
                </div>
              ) : notes === null ? (
                <div className="space-y-3 py-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : notes.length === 0 ? (
                <button onClick={() => setAdding(true)} className="flex w-full items-center gap-3 py-3 text-left">
                  <IconBubble tone="hearth">
                    <KeyRound size={18} />
                  </IconBubble>
                  <div>
                    <p className="font-semibold">Wifi, door codes, the landlord&apos;s number</p>
                    <p className="text-[13px] text-ink-2">Only people who live here can read these.</p>
                  </div>
                </button>
              ) : (
                notes.map((n, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-line/70 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{n.label}</p>
                      <p className="mt-0.5 break-all text-[15px] font-medium">{n.value}</p>
                    </div>
                    <button onClick={() => copy(n.value, `n${i}`)} className="flex size-9 items-center justify-center rounded-full hover:bg-sunken" aria-label={`Copy ${n.label}`}>
                      <Copy size={16} className={copied === `n${i}` ? "text-good" : "text-ink-3"} />
                    </button>
                    <button onClick={() => persist(notes.filter((_, j) => j !== i))} className="flex size-9 items-center justify-center rounded-full hover:bg-bad-tint" aria-label={`Remove ${n.label}`}>
                      <Trash2 size={16} className="text-ink-3" />
                    </button>
                  </div>
                ))
              )}
            </Card>
            <p className="mt-2 flex items-center gap-1.5 px-2 text-[12.5px] text-ink-3">
              <ShieldCheck size={14} /> Encrypted with the house key. Not even Vesta can read them.
            </p>
          </div>
        </>
      ) : !loading ? (
        <Card className="text-center">
          <p className="text-ink-2">You&apos;re not in a house yet.</p>
          <Link href="/house/new" className="mt-4 block">
            <Button className="w-full">Set up a house</Button>
          </Link>
        </Card>
      ) : null}

      <div>
        <SectionTitle>You</SectionTitle>
        <Card pad={false} className="px-4 py-1">
          <Row
            lead={
              <IconBubble>
                <Copy size={17} />
              </IconBubble>
            }
            title={copied === "addr" ? "Copied" : "Your Vesta address"}
            sub={short(s.address)}
            onClick={() => copy(s.address, "addr")}
          />
          <Row
            lead={
              <IconBubble>
                <Lock size={17} />
              </IconBubble>
            }
            title="Lock now"
            sub="Locks by itself after 15 minutes"
            onClick={lock}
          />
          <Row
            lead={
              <IconBubble>
                <LogOut size={17} />
              </IconBubble>
            }
            title="Sign out of this phone"
            sub="Your passkey brings everything back"
            onClick={signOut}
          />
        </Card>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a house note">
        <div className="space-y-4 pb-4">
          <Field label="Label" placeholder="Wifi password" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <Field label="Value" placeholder="hackney-house-2026" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
          {save.error ? <Notice tone="error">{save.error}</Notice> : null}
          <Button className="w-full" busy={save.busy} disabled={!draft.label.trim() || !notes} onClick={() => persist([...(notes ?? []), { label: draft.label.trim(), value: draft.value.trim() }])}>
            Save note
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
