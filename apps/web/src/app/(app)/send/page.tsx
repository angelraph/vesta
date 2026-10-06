"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { confirmWithPasskey } from "@/lib/account";
import { useSession } from "@/lib/hooks";
import { useFx, useHome } from "@/lib/house";
import { formatUsd, fromUnits, readMemory, sendHome, short, toUnits, writeMemory, type Contact, type StewardMemory } from "@/lib/vault";
import { AmountField, Avatar, Button, Card, Field, Header, Notice, useAction } from "@/components/ui";

const corridors = [
  { code: "NGN", label: "Nigeria", symbol: "₦" },
  { code: "GHS", label: "Ghana", symbol: "GH₵" },
  { code: "KES", label: "Kenya", symbol: "KSh" },
  { code: "ZAR", label: "South Africa", symbol: "R" },
  { code: "GBP", label: "United Kingdom", symbol: "£" },
  { code: "EUR", label: "Europe", symbol: "€" },
];

export default function Send() {
  const s = useSession();
  const { view, balances, refresh } = useHome(s);
  const fx = useFx();
  const [memory, setMemory] = useState<StewardMemory | null>(null);
  const [to, setTo] = useState<Contact | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Contact>({ name: "", address: "" as Address, corridor: "NGN" });
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const save = useAction();

  useEffect(() => {
    if (s) readMemory(s).then(setMemory).catch(() => setMemory({ facts: [] }));
  }, [s]);

  if (!s) return null;

  const housemates: Contact[] =
    view?.members
      .filter((m) => m.address.toLowerCase() !== s.address.toLowerCase())
      .map((m) => ({ name: m.name, address: m.address, corridor: "GBP" })) ?? [];
  const contacts = memory?.contacts ?? [];
  const corridor = corridors.find((c) => c.code === (to?.corridor ?? "NGN"))!;
  const rate = fx?.rates[corridor.code];
  const usd = Number(amount) || 0;
  const tooMuch = balances ? toUnits(amount || "0") > balances.ausd : false;

  async function saveContact() {
    if (!s || !isAddress(draft.address) || draft.name.trim().length < 1) return;
    const c = { ...draft, name: draft.name.trim() };
    const next: StewardMemory = { ...(memory ?? { facts: [] }), contacts: [...contacts, c] };
    await save.run(async () => {
      await writeMemory(s, next);
      setMemory(next);
      setTo(c);
      setAdding(false);
      setDraft({ name: "", address: "" as Address, corridor: "NGN" });
    });
  }

  async function onSend() {
    if (!to || !(usd > 0)) return;
    await run(async () => {
      // Money leaving the house always asks for the passkey.
      await confirmWithPasskey();
      const { hash } = await sendHome(s!, to.address, amount, corridor.code, rate ?? 0, memo.trim());
      setSent(hash);
      await refresh();
    });
  }

  if (sent && to) {
    const receipt = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${sent}`;
    return (
      <div className="space-y-5">
        <Header title="Sent" />
        <section className="rounded-3xl bg-hearth p-6 text-cream">
          <p className="text-sm text-cream/70">{to.name} has it</p>
          <p className="num mt-1 font-display text-[40px] leading-none">{formatUsd(usd)}</p>
          {rate && corridor.code !== "USD" ? (
            <p className="num mt-2 text-cream/80">
              worth about {corridor.symbol}
              {(usd * rate).toLocaleString("en-GB", { maximumFractionDigits: 0 })} today
            </p>
          ) : null}
          <p className="mt-4 text-sm text-cream/70">It arrived the moment you confirmed. No waiting, no hidden fee.</p>
        </section>
        <Button
          variant="ember"
          className="w-full"
          onClick={() =>
            navigator.share
              ? navigator.share({ title: "Vesta receipt", text: `I sent you ${formatUsd(usd)}`, url: receipt }).catch(() => null)
              : navigator.clipboard.writeText(receipt)
          }
        >
          Send {to.name} the receipt
        </Button>
        <Link href={`/r/${sent}`}>
          <Button variant="ghost" className="w-full">
            View receipt
          </Button>
        </Link>
        <Button
          variant="quiet"
          className="w-full"
          onClick={() => {
            setSent(null);
            setAmount("");
            setMemo("");
          }}
        >
          Send something else
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header title="Send" />

      <Card className="space-y-3">
        <p className="text-sm font-medium">To</p>
        {contacts.length + housemates.length === 0 && !adding ? (
          <p className="text-sm text-muted">Add someone you send money to. They&apos;re saved, encrypted, to your passkey.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {[...contacts, ...housemates].map((c) => {
            const on = to?.address === c.address;
            return (
              <button
                key={c.address}
                onClick={() => setTo(c)}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${on ? "border-hearth bg-leaf" : "border-line bg-paper"}`}
              >
                <Avatar name={c.name} size={28} />
                {c.name}
              </button>
            );
          })}
          <button onClick={() => setAdding(!adding)} className="rounded-full border border-dashed border-line px-3 py-1 text-sm text-hearth">
            + Someone new
          </button>
        </div>

        {adding ? (
          <div className="space-y-3 rounded-2xl bg-cream p-3">
            <Field label="Name" placeholder="Mama" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Field
              label="Their Vesta address"
              placeholder="0x…"
              value={draft.address}
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, address: e.target.value.trim() as Address })}
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Where they live</span>
              <select
                value={draft.corridor}
                onChange={(e) => setDraft({ ...draft, corridor: e.target.value })}
                className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-[16px]"
              >
                {corridors.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {save.error ? <Notice tone="error">{save.error}</Notice> : null}
            <Button className="w-full" busy={save.busy} disabled={!isAddress(draft.address) || !draft.name.trim()} onClick={saveContact}>
              Save
            </Button>
          </div>
        ) : null}
      </Card>

      {to ? (
        <Card className="space-y-4">
          <AmountField
            value={amount}
            onChange={setAmount}
            autoFocus
            label={`How much for ${to.name}`}
            hint={
              <>
                {balances ? `You have ${formatUsd(balances.ausd)}. ` : ""}
                {rate && usd > 0 && corridor.code !== "GBP"
                  ? `${to.name} gets about ${corridor.symbol}${(usd * rate).toLocaleString("en-GB", { maximumFractionDigits: 0 })}.`
                  : ""}
              </>
            }
          />
          <Field label="Note (optional)" placeholder="For school fees" value={memo} maxLength={80} onChange={(e) => setMemo(e.target.value)} />
          {tooMuch ? <Notice tone="error">That&apos;s more than your balance.</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button variant="ember" className="w-full" busy={busy} disabled={!(usd > 0) || tooMuch} onClick={onSend}>
            Send {usd > 0 ? formatUsd(usd) : ""} to {to.name}
          </Button>
          <p className="text-center text-xs text-muted">
            To {short(to.address)}. You&apos;ll confirm with your passkey. It arrives straight away.
          </p>
        </Card>
      ) : null}

      {balances && fromUnits(balances.ausd) === 0 ? (
        <Notice>
          Your balance is empty. <Link href="/topup" className="font-semibold underline">Top up</Link> to send money.
        </Notice>
      ) : null}
    </div>
  );
}
