"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { Address } from "viem";
import { ArrowRight, Plus, Receipt } from "lucide-react";
import { confirmWithPasskey } from "@/lib/account";
import { SESSION_LIMIT_USD } from "@/lib/config";
import { useSession } from "@/lib/hooks";
import { useHome } from "@/lib/house";
import { useActivity } from "@/lib/activity";
import { addExpense, fromUnits, settle, type Member } from "@/lib/vault";
import { ActivityList } from "@/components/ActivityList";
import { Avatar, Button, Card, Empty, Field, Money, Notice, PageTitle, SectionTitle, Sheet, SuccessMark, cleanAmount, useAction } from "@/components/ui";

type Transfer = { from: Member; to: Member; amount: bigint };

/** Fewest payments that square everyone up. */
function plan(members: Member[]): Transfer[] {
  const debtors = members.filter((m) => m.net < 0n).map((m) => ({ m, left: -m.net }));
  const creditors = members.filter((m) => m.net > 0n).map((m) => ({ m, left: m.net }));
  debtors.sort((a, b) => (b.left > a.left ? 1 : -1));
  creditors.sort((a, b) => (b.left > a.left ? 1 : -1));
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = debtors[i].left < creditors[j].left ? debtors[i].left : creditors[j].left;
    out.push({ from: debtors[i].m, to: creditors[j].m, amount: amt });
    debtors[i].left -= amt;
    creditors[j].left -= amt;
    if (debtors[i].left === 0n) i++;
    if (creditors[j].left === 0n) j++;
  }
  return out;
}

export default function SplitPage() {
  return (
    <Suspense>
      <Split />
    </Suspense>
  );
}

function Split() {
  const s = useSession();
  const params = useSearchParams();
  const { view, houseIds, refresh } = useHome(s);
  const activity = useActivity(s?.address, houseIds, 30);
  const [open, setOpen] = useState(() => params.get("add") === "1");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const add = useAction();
  const pay = useAction();

  const transfers = useMemo(() => (view ? plan(view.members) : []), [view]);
  const names = useMemo(() => Object.fromEntries((view?.members ?? []).map((m) => [m.address.toLowerCase(), m.name])), [view]);
  const tab = useMemo(() => (activity.data ?? []).filter((a) => a.kind === "expense" || a.kind === "settle"), [activity.data]);

  if (!s) return null;
  const mine = s.address.toLowerCase();

  if (!view) {
    return (
      <div>
        <div className="pt-safe" />
        <PageTitle>Split</PageTitle>
        <Card>
          <Empty icon={<Receipt size={22} />} title="Splits happen inside a house">
            Set up a house or join one to start sharing costs.
          </Empty>
          <Link href="/house/new">
            <Button className="w-full">Set up a house</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const me = view.me;
  const who = new Set(view.members.map((m) => m.address).filter((a) => !left.has(a)));
  const n = who.size || 1;
  const each = Number(amount) > 0 ? Number(amount) / n : 0;

  function done(text: string) {
    setFlash(text);
    setTimeout(() => setFlash(null), 3500);
  }

  async function onAdd() {
    await add.run(async () => {
      await addExpense(s!, view!.house.id, amount, memo.trim() || "Shared cost", [...who] as Address[]);
      setOpen(false);
      done(`Added ${memo.trim() || "shared cost"}, $${Number(amount).toFixed(2)} split ${n} ways`);
      setAmount("");
      setMemo("");
      await refresh();
    });
  }

  async function onSettle(t: Transfer) {
    await pay.run(async () => {
      if (fromUnits(t.amount) > SESSION_LIMIT_USD) await confirmWithPasskey();
      await settle(s!, view!.house.id, t.to.address, String(fromUnits(t.amount)));
      done(`Paid ${t.to.name} back $${fromUnits(t.amount).toFixed(2)}`);
      await refresh();
    });
  }

  const net = me ? fromUnits(me.net) : 0;

  return (
    <div className="space-y-6">
      <div className="pt-safe" />
      <div className="px-1">
        <p className="text-[14px] font-medium text-ink-2">{view.house.name} tab</p>
        <p className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight">
          {net > 0 ? (
            <>
              You&apos;re owed <span className="text-good"><Money value={net} /></span>
            </>
          ) : net < 0 ? (
            <>
              You owe <Money value={-net} />
            </>
          ) : (
            "All square"
          )}
        </p>
      </div>

      <Button className="w-full" onClick={() => setOpen(true)}>
        <Plus size={20} /> Add a shared cost
      </Button>

      {flash ? (
        <Card className="rise flex items-center gap-4">
          <SuccessMark size={40} />
          <p className="font-semibold">{flash}</p>
        </Card>
      ) : null}

      <div>
        <SectionTitle>Settle up</SectionTitle>
        <Card pad={false} className="px-4 py-2">
          {transfers.length === 0 ? (
            <p className="py-4 text-center text-[14px] text-ink-2">Nobody owes anybody. Nice.</p>
          ) : (
            transfers.map((t, i) => {
              const fromMe = t.from.address.toLowerCase() === mine;
              const toMe = t.to.address.toLowerCase() === mine;
              return (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="flex items-center">
                    <Avatar name={t.from.name} size={34} ring />
                    <ArrowRight size={14} className="mx-1 text-ink-3" />
                    <Avatar name={t.to.name} size={34} ring />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">
                      {fromMe ? "You" : t.from.name} → {toMe ? "you" : t.to.name}
                    </p>
                    <p className="text-[13px] text-ink-2">
                      <Money value={fromUnits(t.amount)} />
                    </p>
                  </div>
                  {fromMe ? (
                    <Button size="sm" busy={pay.busy} onClick={() => onSettle(t)}>
                      Pay
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
          {pay.error ? (
            <div className="pb-2">
              <Notice tone="error">{pay.error}</Notice>
            </div>
          ) : null}
        </Card>
      </div>

      <div>
        <SectionTitle>History</SectionTitle>
        <Card pad={false} className="px-4 py-2">
          <ActivityList items={activity.data ? tab : null} me={s.address} names={names} unavailable={!process.env.NEXT_PUBLIC_INDEXER_URL} />
        </Card>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Add a shared cost">
        <div className="space-y-5 pb-4">
          <label className="block text-center">
            <span className="text-[13px] font-semibold text-ink-2">You paid</span>
            <div className="mt-1 flex items-baseline justify-center">
              <span className="text-[34px] font-extrabold text-ink-3">$</span>
              <input
                inputMode="decimal"
                autoFocus
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(cleanAmount(e.target.value))}
                className="num w-40 bg-transparent text-center text-[44px] font-extrabold outline-none placeholder:text-ink-3/40"
              />
            </div>
          </label>
          <Field label="What for" placeholder="Dinner at Mara's, electric bill…" value={memo} maxLength={80} onChange={(e) => setMemo(e.target.value)} />
          <div>
            <span className="mb-2 block px-1 text-[13px] font-semibold text-ink-2">Split between</span>
            <div className="flex flex-wrap gap-2">
              {view.members.map((m) => {
                const on = who.has(m.address);
                return (
                  <button
                    key={m.address}
                    onClick={() => {
                      const next = new Set(left);
                      if (on) next.add(m.address);
                      else next.delete(m.address);
                      setLeft(next);
                    }}
                    className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[14px] font-semibold transition ${on ? "bg-hearth text-white" : "bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)]"}`}
                  >
                    <Avatar name={m.name} size={28} />
                    {m.address.toLowerCase() === mine ? "You" : m.name}
                  </button>
                );
              })}
            </div>
            <p className="num mt-2 px-1 text-[13px] text-ink-2">{each > 0 ? `$${each.toFixed(2)} each` : " "}</p>
          </div>
          {add.error ? <Notice tone="error">{add.error}</Notice> : null}
          <Button className="w-full" busy={add.busy} disabled={!(Number(amount) > 0) || who.size === 0} onClick={onAdd}>
            Add to the tab
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
