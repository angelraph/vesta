"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/hooks";
import { daysUntil, useFx, useHome } from "@/lib/house";
import { collectRent, formatUsd, fromUnits, payRent } from "@/lib/vault";
import { Avatar, Button, Card, Done, Notice, useAction } from "@/components/ui";
import { Mark } from "@/components/Logo";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

export default function Home() {
  const s = useSession();
  const { loading, view, balances, refresh } = useHome(s);
  const fx = useFx();
  const { busy, error, run } = useAction();
  const [done, setDone] = useState<{ title: string; hash: string } | null>(null);

  if (!s) return null;
  const me = view?.me;
  const gbp = fx?.rates.GBP;

  const myShare = view ? view.sharePerMember : 0n;
  const myOutstanding = me && myShare > me.rentPaid ? myShare - me.rentPaid : 0n;
  const potPct = view && view.house.rent > 0n ? Math.min(100, Number((view.house.pot * 100n) / view.house.rent)) : 0;
  const dueIn = view ? daysUntil(view.house.nextDue) : 0;
  const canPayLandlord = view && dueIn <= 0 && view.house.pot >= view.house.rent;

  async function onPayShare() {
    if (!view || myOutstanding === 0n) return;
    await run(async () => {
      const { hash } = await payRent(s!, view.house.id, String(fromUnits(myOutstanding)));
      setDone({ title: `Your rent share is in. ${formatUsd(myOutstanding)}`, hash });
      await refresh();
    });
  }

  async function onCollect() {
    if (!view) return;
    await run(async () => {
      const { hash } = await collectRent(s!, view.house.id);
      setDone({ title: "Rent paid to the landlord.", hash });
      await refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="pt-safe flex items-center justify-between pb-1">
        <div>
          <p className="text-sm text-muted">
            {greeting()}
            {me ? `, ${me.name}` : ""}
          </p>
          <h1 className="font-display text-[26px] font-semibold tracking-tight">{view ? view.house.name : "Your home"}</h1>
        </div>
        <Mark size={36} animated />
      </div>

      <section className="rounded-3xl bg-hearth p-5 text-cream">
        <p className="text-sm text-cream/70">Your balance</p>
        <p className="num mt-1 font-display text-[40px] leading-none">{balances ? formatUsd(balances.ausd) : "…"}</p>
        {balances && gbp ? (
          <p className="num mt-1.5 text-sm text-cream/70">
            about £{(fromUnits(balances.ausd) * gbp).toLocaleString("en-GB", { maximumFractionDigits: 2 })}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href="/topup" className="rounded-2xl bg-cream/10 px-4 py-3 text-center text-sm font-semibold hover:bg-cream/15">
            Top up
          </Link>
          <Link href="/send" className="rounded-2xl bg-ember px-4 py-3 text-center text-sm font-semibold text-white hover:brightness-95">
            Send home
          </Link>
        </div>
      </section>

      {done ? <Done title={done.title} hash={done.hash} /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {loading ? (
        <Card>
          <p className="text-muted">Opening your house…</p>
        </Card>
      ) : !view ? (
        <Card className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Start your house</h2>
            <p className="mt-1 text-sm text-muted">
              Set the rent once. Everyone pays their share into one pot and the landlord gets paid on rent day.
            </p>
          </div>
          <Link href="/house/new">
            <Button className="w-full">Set up a house</Button>
          </Link>
          <p className="text-center text-sm text-muted">Got an invite? Open the link your housemate sent you.</p>
        </Card>
      ) : (
        <>
          <Card className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold">Rent pot</h2>
              <span className="text-sm text-muted">
                {dueIn > 1 ? `due in ${dueIn} days` : dueIn === 1 ? "due tomorrow" : dueIn === 0 ? "due today" : "rent day has passed"}
              </span>
            </div>
            <div>
              <div className="num flex items-baseline justify-between">
                <span className="font-display text-2xl">{formatUsd(view.house.pot)}</span>
                <span className="text-sm text-muted">of {formatUsd(view.house.rent)}</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-leaf">
                <div className="h-full rounded-full bg-ember transition-all duration-700" style={{ width: `${potPct}%` }} />
              </div>
            </div>
            <ul className="divide-y divide-line">
              {view.members.map((m) => {
                const owes = view.sharePerMember > m.rentPaid ? view.sharePerMember - m.rentPaid : 0n;
                return (
                  <li key={m.address} className="flex items-center gap-3 py-2.5">
                    <Avatar name={m.name} />
                    <span className="flex-1 font-medium">
                      {m.name}
                      {m.address.toLowerCase() === s.address.toLowerCase() ? <span className="text-muted"> (you)</span> : null}
                    </span>
                    <span className={`num text-sm ${owes === 0n ? "text-hearth" : "text-muted"}`}>
                      {owes === 0n ? "Paid" : `${formatUsd(owes)} to go`}
                    </span>
                  </li>
                );
              })}
            </ul>
            {canPayLandlord ? (
              <Button className="w-full" busy={busy} onClick={onCollect}>
                Pay the landlord now
              </Button>
            ) : myOutstanding > 0n ? (
              <Button className="w-full" busy={busy} onClick={onPayShare}>
                Pay my share · {formatUsd(myOutstanding)}
              </Button>
            ) : (
              <Notice>You&apos;re all paid up for this month.</Notice>
            )}
          </Card>

          {me ? (
            <Link href="/split">
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Bills and splits</p>
                  <p className="num mt-0.5 font-display text-xl">
                    {me.net > 0n ? `You're owed ${formatUsd(me.net)}` : me.net < 0n ? `You owe ${formatUsd(-me.net)}` : "All square"}
                  </p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Card>
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
