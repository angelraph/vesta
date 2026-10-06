"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { confirmWithPasskey } from "@/lib/account";
import { SESSION_LIMIT_USD } from "@/lib/config";
import { useSession } from "@/lib/hooks";
import { useHome } from "@/lib/house";
import { addExpense, formatUsd, fromUnits, settle, type Member } from "@/lib/vault";
import { AmountField, Avatar, Button, Card, Done, Field, Header, Notice, useAction } from "@/components/ui";

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

export default function Split() {
  const s = useSession();
  const { view, refresh } = useHome(s);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [who, setWho] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ title: string; hash: string } | null>(null);
  const add = useAction();
  const pay = useAction();

  useEffect(() => {
    if (view && who.size === 0) setWho(new Set(view.members.map((m) => m.address)));
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const transfers = useMemo(() => (view ? plan(view.members) : []), [view]);

  if (!s) return null;
  if (!view) {
    return (
      <div>
        <Header title="Split" />
        <Card>
          <p className="text-muted">Join or set up a house first. Splits happen between housemates.</p>
        </Card>
      </div>
    );
  }

  const n = who.size || 1;
  const each = Number(amount) > 0 ? Number(amount) / n : 0;

  async function onAdd() {
    await add.run(async () => {
      const { hash } = await addExpense(s!, view!.house.id, amount, memo.trim() || "Shared cost", [...who] as Address[]);
      setDone({ title: `Added. ${formatUsd(Number(amount))} split ${n} ways.`, hash });
      setAmount("");
      setMemo("");
      await refresh();
    });
  }

  async function onSettle(t: Transfer) {
    await pay.run(async () => {
      if (fromUnits(t.amount) > SESSION_LIMIT_USD) await confirmWithPasskey();
      const { hash } = await settle(s!, view!.house.id, t.to.address, String(fromUnits(t.amount)));
      setDone({ title: `Paid ${t.to.name} back ${formatUsd(t.amount)}.`, hash });
      await refresh();
    });
  }

  const mine = s.address.toLowerCase();

  return (
    <div className="space-y-5">
      <Header title="Split" />

      {done ? <Done title={done.title} hash={done.hash} /> : null}

      <Card className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Who owes who</h2>
        {transfers.length === 0 ? (
          <Notice>Everyone&apos;s square. Nice.</Notice>
        ) : (
          <ul className="space-y-2">
            {transfers.map((t, i) => {
              const isMe = t.from.address.toLowerCase() === mine;
              return (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-cream px-3 py-3">
                  <Avatar name={t.from.name} size={32} />
                  <p className="flex-1 text-sm">
                    <span className="font-semibold">{isMe ? "You" : t.from.name}</span> owe{isMe ? "" : "s"}{" "}
                    <span className="font-semibold">{t.to.address.toLowerCase() === mine ? "you" : t.to.name}</span>
                    <span className="num block font-display text-lg">{formatUsd(t.amount)}</span>
                  </p>
                  {isMe ? (
                    <Button className="min-h-10 px-4 text-sm" busy={pay.busy} onClick={() => onSettle(t)}>
                      Pay
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {pay.error ? <Notice tone="error">{pay.error}</Notice> : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Add a shared cost</h2>
        <AmountField value={amount} onChange={setAmount} label="You paid" />
        <Field label="What for" placeholder="Dinner at Mara's, electric bill…" value={memo} maxLength={80} onChange={(e) => setMemo(e.target.value)} />
        <div>
          <p className="mb-2 text-sm font-medium">Split between</p>
          <div className="flex flex-wrap gap-2">
            {view.members.map((m) => {
              const on = who.has(m.address);
              return (
                <button
                  key={m.address}
                  onClick={() => {
                    const next = new Set(who);
                    if (on) next.delete(m.address);
                    else next.add(m.address);
                    setWho(next);
                  }}
                  className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition ${on ? "border-hearth bg-leaf" : "border-line bg-paper text-muted"}`}
                >
                  <Avatar name={m.name} size={26} />
                  {m.address.toLowerCase() === mine ? "You" : m.name}
                </button>
              );
            })}
          </div>
          {each > 0 ? <p className="num mt-2 text-sm text-muted">{formatUsd(each)} each</p> : null}
        </div>
        {add.error ? <Notice tone="error">{add.error}</Notice> : null}
        <Button className="w-full" busy={add.busy} disabled={!(Number(amount) > 0) || who.size === 0} onClick={onAdd}>
          Add to the house
        </Button>
      </Card>
    </div>
  );
}
