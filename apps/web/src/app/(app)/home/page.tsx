"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronRight, Home as HomeIcon, Plus, Send, SplitSquareHorizontal, Sparkles, Wallet } from "lucide-react";
import { useSession } from "@/lib/hooks";
import { daysUntil, useFx, useHome } from "@/lib/house";
import { useActivity } from "@/lib/activity";
import { collectRent, fromUnits, payRent, setName, usdText } from "@/lib/vault";
import { TestMoneyButton } from "@/components/TestMoney";
import { ActivityList } from "@/components/ActivityList";
import { Avatar, Button, Card, CountUp, Money, Notice, QuickAction, SectionTitle, Skeleton, SuccessMark, useAction } from "@/components/ui";
import { Mark } from "@/components/Logo";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function dueText(days: number, ts: bigint) {
  const date = new Date(Number(ts) * 1000);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  if (days < 0) return "Rent day has passed";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due ${weekday}`;
  return `Due ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export default function Home() {
  const s = useSession();
  const { loading, view, balances, houseIds, name, nameMissing, refreshName, refresh } = useHome(s);
  const [newName, setNewName] = useState("");
  const fx = useFx();
  const activity = useActivity(s?.address, houseIds, 6);
  const { busy, error, run } = useAction();
  const [paid, setPaid] = useState<string | null>(null);

  const names = useMemo(
    () => Object.fromEntries((view?.members ?? []).map((m) => [m.address.toLowerCase(), m.name])),
    [view],
  );

  if (!s) return null;
  const me = view?.me;
  const gbp = fx?.rates.GBP;
  const share = view?.sharePerMember ?? 0n;
  const myLeft = me && share > me.rentPaid ? share - me.rentPaid : 0n;
  // Pay what you can: the pot takes part payments, so never ask for more than the balance.
  const wallet = balances?.ausd ?? 0n;
  const payable = myLeft > wallet ? wallet : myLeft;
  const potPct = view && view.house.rent > 0n ? Math.min(100, Number((view.house.pot * 1000n) / view.house.rent) / 10) : 0;
  const days = view ? daysUntil(view.house.nextDue) : 0;
  const covered = view ? view.house.pot >= view.house.rent : false;
  const canPayLandlord = view && days <= 0 && covered;
  const short = view?.members
    .map((m) => ({ m, left: share > m.rentPaid ? share - m.rentPaid : 0n }))
    .filter((x) => x.left > 0n && x.m.address.toLowerCase() !== s.address.toLowerCase());

  async function onPayShare() {
    if (!view || payable === 0n) return;
    await run(async () => {
      await payRent(s!, view.house.id, String(fromUnits(payable)));
      setPaid(payable < myLeft ? `${usdText(payable)} is in the pot` : `Your share is in`);
      await refresh();
      setTimeout(() => setPaid(null), 4000);
    });
  }

  async function onCollect() {
    if (!view) return;
    await run(async () => {
      await collectRent(s!, view.house.id);
      setPaid("Rent paid to the landlord");
      await refresh();
      setTimeout(() => setPaid(null), 4000);
    });
  }

  function nudge(name: string, amount: number) {
    const text = `Hey ${name}, rent's ${dueText(days, view!.house.nextDue).toLowerCase()}. You're $${amount.toFixed(2)} short on Vesta. Pop it in when you can 🙏`;
    if (navigator.share) navigator.share({ text }).catch(() => null);
    else navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <header className="pt-safe flex items-center justify-between pb-1">
        <Link href="/house" className="flex items-center gap-3">
          <Avatar name={me?.name ?? name ?? "You"} size={42} />
          <div>
            <p className="text-[13px] text-ink-2">{greeting()}</p>
            <p className="text-[17px] font-bold leading-tight">{me?.name ?? name ?? (loading ? "…" : "Welcome")}</p>
          </div>
        </Link>
        <Link href="/steward" className="flex size-11 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_rgba(15,31,26,0.06)]" aria-label="Steward">
          <Mark size={24} animated />
        </Link>
      </header>

      {nameMissing ? (
        <Card className="space-y-3">
          <div>
            <p className="font-bold">What should your housemates call you?</p>
            <p className="text-[13.5px] text-ink-2">Right now they see a code instead of your name.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={newName}
              maxLength={32}
              placeholder="Your name"
              onChange={(e) => setNewName(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-xl bg-sunken px-4 text-[16px] outline-none focus:shadow-[0_0_0_2px_var(--hearth)]"
            />
            <Button
              size="md"
              className="h-12"
              busy={busy}
              disabled={newName.trim().length < 2}
              onClick={() =>
                run(async () => {
                  await setName(s!, newName.trim());
                  await Promise.all([refreshName(), refresh()]);
                })
              }
            >
              Save
            </Button>
          </div>
        </Card>
      ) : null}

      {/* balance */}
      <section className="px-1 text-center">
        <p className="text-[14px] font-medium text-ink-2">Your balance</p>
        {balances ? (
          <p className="mt-1 text-[46px] font-extrabold leading-none tracking-[-0.03em]">
            <CountUp value={fromUnits(balances.ausd)} />
          </p>
        ) : (
          <Skeleton className="mx-auto mt-2 h-11 w-48" />
        )}
        <p className="num mt-2 h-5 text-[14px] text-ink-2">
          {balances && gbp ? `≈ £${(fromUnits(balances.ausd) * gbp).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
        </p>
        {balances && balances.received > 0 ? (
          <p className="num mt-1 text-[14px] font-semibold text-good">
            + ${balances.received.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} received from abroad, ready to cash out
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-4 gap-2 px-1">
        <QuickAction href="/topup" icon={<Plus size={22} />} label="Add money" />
        <QuickAction href="/send" icon={<Send size={20} />} label="Send home" tone="ember" />
        <QuickAction href="/split?add=1" icon={<SplitSquareHorizontal size={20} />} label="Split" />
        <QuickAction href="/house" icon={<HomeIcon size={20} />} label="House" />
      </div>

      {paid ? (
        <Card className="rise flex items-center gap-4">
          <SuccessMark size={44} />
          <p className="font-semibold">{paid}</p>
        </Card>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* rent pot */}
      {loading ? (
        <Card className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-2.5 w-full" />
        </Card>
      ) : !view ? (
        <Card className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-hearth-tint">
            <Mark size={30} />
          </span>
          <h2 className="mt-4 text-[19px] font-bold">Set up your house</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-[14px] text-ink-2">
            Add the rent once. Everyone pays their share into one pot, and the landlord gets paid on rent day.
          </p>
          <Link href="/house/new" className="mt-5 block">
            <Button className="w-full">Set up a house</Button>
          </Link>
          <p className="mt-3 text-[13px] text-ink-3">Moving into a house on Vesta? Open the invite link you were sent.</p>
        </Card>
      ) : (
        <div>
          <SectionTitle
            action={
              <Link href="/house" className="flex items-center text-[13px] font-semibold text-hearth">
                {view.house.name} <ChevronRight size={16} />
              </Link>
            }
          >
            Rent
          </SectionTitle>
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[30px] font-extrabold leading-none tracking-tight">
                  <Money value={fromUnits(view.house.rent)} cents={false} />
                </p>
                <p className="mt-1.5 text-[14px] text-ink-2">{dueText(days, view.house.nextDue)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${covered ? "bg-hearth-tint text-good" : "bg-ember-tint text-warn"}`}>
                {covered ? "Covered" : `$${fromUnits(view.house.rent - view.house.pot).toLocaleString("en-GB", { maximumFractionDigits: 2 })} to go`}
              </span>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sunken">
              <div className={`grow-bar h-full rounded-full transition-all duration-700 ${covered ? "bg-good" : "bg-ember"}`} style={{ width: `${potPct}%` }} />
            </div>

            <ul className="mt-4 space-y-0.5">
              {view.members.map((m) => {
                const left = share > m.rentPaid ? share - m.rentPaid : 0n;
                const isMe = m.address.toLowerCase() === s.address.toLowerCase();
                return (
                  <li key={m.address} className="flex items-center gap-3 py-1.5">
                    <Avatar name={m.name} size={30} />
                    <span className="flex-1 text-[15px] font-medium">{isMe ? "You" : m.name}</span>
                    {left === 0n ? (
                      <span className="flex items-center gap-1 text-[14px] font-semibold text-good">
                        <Money value={fromUnits(share)} cents={false} /> <Check size={16} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="num text-[14px] text-ink-2">
                        <Money value={fromUnits(left)} /> short
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4">
              {canPayLandlord ? (
                <Button className="w-full" busy={busy} onClick={onCollect}>
                  Pay the landlord
                </Button>
              ) : myLeft > 0n && payable === myLeft ? (
                <Button className="w-full" busy={busy} onClick={onPayShare}>
                  Pay your share · <Money value={fromUnits(myLeft)} />
                </Button>
              ) : myLeft > 0n && payable > 0n ? (
                <Button className="w-full" busy={busy} onClick={onPayShare}>
                  Pay <Money value={fromUnits(payable)} /> of <Money value={fromUnits(myLeft)} />
                </Button>
              ) : myLeft > 0n ? (
                <p className="rounded-2xl bg-ember-tint px-4 py-3 text-center text-[14px] font-medium text-warn">
                  Your share is <Money value={fromUnits(myLeft)} />. Add money below to pay it.
                </p>
              ) : (
                <p className="rounded-2xl bg-hearth-tint px-4 py-3 text-center text-[14px] font-medium text-hearth">You&apos;re paid up this month.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* steward nudge */}
      {view && short && short.length > 0 && days <= 10 ? (
        <Card className="border-l-4 border-ember">
          <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-ember">
            <Sparkles size={14} /> Steward
          </div>
          <p className="mt-2 text-[16px] font-semibold leading-snug">
            {short.length === 1
              ? `${short[0].m.name} is $${fromUnits(short[0].left).toFixed(2)} short.`
              : `${short.map((x) => x.m.name).join(" and ")} still need to pay in.`}{" "}
            Rent is {dueText(days, view.house.nextDue).toLowerCase()}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {short.slice(0, 2).map((x) => (
              <Button key={x.m.address} size="sm" variant="secondary" onClick={() => nudge(x.m.name, fromUnits(x.left))}>
                Message {x.m.name}
              </Button>
            ))}
            <Link href="/steward">
              <Button size="sm" variant="ghost">
                Ask the steward
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {/* activity */}
      <div>
        <SectionTitle
          action={
            <Link href="/activity" className="text-[13px] font-semibold text-hearth">
              See all
            </Link>
          }
        >
          Recent activity
        </SectionTitle>
        <Card pad={false} className="px-4 py-2">
          <ActivityList items={activity.data ?? null} me={s.address} names={names} loading={activity.data === null && !activity.error} unavailable={activity.data === null && !process.env.NEXT_PUBLIC_INDEXER_URL} />
        </Card>
      </div>

      {balances && fromUnits(balances.ausd) === 0 && !loading ? (
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-ember-tint text-ember">
              <Wallet size={18} />
            </span>
            <div className="flex-1">
              <p className="font-semibold">Add money to get started</p>
              <p className="text-[13px] text-ink-2">Vesta runs on a test network, so you can add $100 of test money to try everything.</p>
            </div>
          </div>
          <TestMoneyButton s={s} onDone={refresh} />
          <Link href="/topup" className="block text-center text-[13px] font-semibold text-hearth">
            Other ways to add money
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
