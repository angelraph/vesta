"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { ArrowDownUp, Fingerprint, Plus, Search, Share2, Zap } from "lucide-react";
import { confirmWithPasskey } from "@/lib/account";
import { useSession } from "@/lib/hooks";
import { useFx, useHome } from "@/lib/house";
import { fromUnits, readMemory, sendHome, short, toUnits, writeMemory, type Contact, type StewardMemory } from "@/lib/vault";
import { Avatar, Button, Card, Divider, Field, Money, Notice, PageTitle, Row, Sheet, SuccessMark, TopBar, cleanAmount, useAction } from "@/components/ui";

const countries = [
  { code: "NGN", name: "Nigeria", flag: "🇳🇬", symbol: "₦" },
  { code: "GHS", name: "Ghana", flag: "🇬🇭", symbol: "GH₵" },
  { code: "KES", name: "Kenya", flag: "🇰🇪", symbol: "KSh" },
  { code: "ZAR", name: "South Africa", flag: "🇿🇦", symbol: "R" },
  { code: "GBP", name: "United Kingdom", flag: "🇬🇧", symbol: "£" },
  { code: "EUR", name: "Europe", flag: "🇪🇺", symbol: "€" },
];
const country = (code: string) => countries.find((c) => c.code === code) ?? countries[0];
const fmtLocal = (n: number, code: string) => `${country(code).symbol}${n.toLocaleString("en-GB", { maximumFractionDigits: code === "NGN" || code === "KES" ? 0 : 2 })}`;

type Step = "who" | "amount" | "review" | "done";

export default function Send() {
  const s = useSession();
  const { view, balances, refresh } = useHome(s);
  const fx = useFx();
  const [memory, setMemory] = useState<StewardMemory | null>(null);
  const [step, setStep] = useState<Step>("who");
  const [to, setTo] = useState<Contact | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Contact>({ name: "", address: "" as Address, corridor: "NGN" });
  const [usd, setUsd] = useState("");
  const [local, setLocal] = useState("");
  const [memo, setMemo] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const send = useAction();
  const save = useAction();

  useEffect(() => {
    if (s) readMemory(s).then(setMemory).catch(() => setMemory({ facts: [] }));
  }, [s]);

  const housemates: Contact[] = useMemo(
    () =>
      view?.members
        .filter((m) => s && m.address.toLowerCase() !== s.address.toLowerCase())
        .map((m) => ({ name: m.name, address: m.address, corridor: "GBP" })) ?? [],
    [view, s],
  );
  const contacts = memory?.contacts ?? [];
  const match = (c: Contact) => c.name.toLowerCase().includes(q.toLowerCase());

  if (!s) return null;

  const c = country(to?.corridor ?? "NGN");
  const rate = fx?.rates[c.code];
  const usdN = Number(usd) || 0;
  const balance = balances ? fromUnits(balances.ausd) : 0;
  const over = balances ? toUnits(usd || "0") > balances.ausd : false;

  function onUsd(v: string) {
    const clean = cleanAmount(v);
    setUsd(clean);
    setLocal(rate && clean ? String(Math.round(Number(clean) * rate * 100) / 100) : "");
  }
  function onLocal(v: string) {
    const clean = cleanAmount(v);
    setLocal(clean);
    setUsd(rate && clean ? (Number(clean) / rate).toFixed(2) : "");
  }

  async function saveContact() {
    if (!isAddress(draft.address) || !draft.name.trim()) return;
    const contact = { ...draft, name: draft.name.trim() };
    const next: StewardMemory = { ...(memory ?? { facts: [] }), contacts: [...contacts, contact] };
    await save.run(async () => {
      await writeMemory(s!, next);
      setMemory(next);
      setAdding(false);
      setDraft({ name: "", address: "" as Address, corridor: "NGN" });
      setTo(contact);
      setStep("amount");
    });
  }

  async function confirm() {
    if (!to) return;
    await send.run(async () => {
      await confirmWithPasskey();
      const res = await sendHome(s!, to.address, usd, c.code, rate ?? 0, memo.trim());
      setHash(res.hash);
      setStep("done");
      refresh();
    });
  }

  // ------------------------------------------------------------- done
  if (step === "done" && to && hash) {
    const receipt = `${window.location.origin}/r/${hash}`;
    return (
      <div className="flex min-h-dvh flex-col pb-safe">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <SuccessMark />
          <p className="rise mt-6 text-[15px] font-medium text-ink-2">Sent to {to.name}</p>
          <p className="rise mt-1 text-[44px] font-extrabold leading-none tracking-tight">
            <Money value={usdN} />
          </p>
          {rate && c.code !== "USD" ? <p className="rise num mt-2 text-[17px] font-semibold text-good">{fmtLocal(usdN * rate, c.code)} received</p> : null}
          <div className="rise mt-6 flex items-center gap-2 rounded-full bg-hearth-tint px-4 py-2 text-[13px] font-semibold text-hearth">
            <Zap size={14} /> Arrived in under a second
          </div>
        </div>
        <div className="space-y-3">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              navigator.share
                ? navigator.share({ title: "Vesta", text: `I've sent you $${usdN.toFixed(2)}`, url: receipt }).catch(() => null)
                : navigator.clipboard.writeText(receipt)
            }
          >
            <Share2 size={18} /> Share receipt with {to.name}
          </Button>
          <Link href={`/r/${hash}`} className="block">
            <Button variant="ghost" className="w-full">
              View receipt
            </Button>
          </Link>
          <Link href="/home" className="block">
            <Button className="w-full">Done</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------- review
  if (step === "review" && to) {
    return (
      <div>
        <TopBar title="Review" onBack={() => setStep("amount")} />
        <div className="mt-2 flex flex-col items-center text-center">
          <span className="relative">
            <Avatar name={to.name} size={64} />
            <span className="absolute -bottom-1 -right-1 text-[22px]">{c.flag}</span>
          </span>
          <p className="mt-3 text-[15px] text-ink-2">You&apos;re sending {to.name}</p>
          <p className="mt-1 text-[40px] font-extrabold leading-none tracking-tight">
            <Money value={usdN} />
          </p>
        </div>

        <Card className="mt-6 space-y-3.5 text-[15px]">
          <Line label="To" value={`${to.name} · ${c.name}`} />
          <Line label="Their account" value={short(to.address)} />
          <Divider />
          <Line label="You send" value={<Money value={usdN} />} />
          <Line label="Fee" value={<span className="text-good">$0.00</span>} />
          {rate && c.code !== "USD" ? <Line label="Rate" value={`$1 = ${fmtLocal(rate, c.code)}`} /> : null}
          <Divider />
          {rate ? <Line label={`${to.name} gets`} value={<span className="font-bold">{fmtLocal(usdN * rate, c.code)}</span>} /> : null}
          <Line label="Arrives" value="In seconds" />
          {memo ? <Line label="Note" value={memo} /> : null}
        </Card>

        <p className="mt-4 px-2 text-center text-[12.5px] text-ink-3">
          Settled instantly through Agora, so {to.name} is paid out the moment you send. The rate shown is today&apos;s mid-market rate.
        </p>

        <div className="mt-6 space-y-3">
          {send.error ? <Notice tone="error">{send.error}</Notice> : null}
          <Button variant="ember" className="w-full" busy={send.busy} onClick={confirm}>
            <Fingerprint size={20} /> Confirm and send
          </Button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------- amount
  if (step === "amount" && to) {
    return (
      <div>
        <TopBar title={`Send to ${to.name}`} onBack={() => setStep("who")} />

        <Card pad={false} className="mt-2 overflow-hidden">
          <label className="block px-5 pb-4 pt-4">
            <span className="text-[13px] font-semibold text-ink-2">You send</span>
            <div className="mt-1 flex items-center gap-3">
              <input
                inputMode="decimal"
                autoFocus
                placeholder="0"
                value={usd}
                onChange={(e) => onUsd(e.target.value)}
                className="num min-w-0 flex-1 bg-transparent text-[34px] font-extrabold outline-none placeholder:text-ink-3/50"
              />
              <span className="flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1.5 text-[14px] font-bold">🇺🇸 USD</span>
            </div>
            <span className={`text-[12.5px] ${over ? "text-bad" : "text-ink-3"}`}>
              {over ? "More than your balance" : `Balance $${balance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
            </span>
          </label>

          <div className="relative bg-sunken/60 px-5 py-3 text-[13.5px]">
            <div className="absolute -top-4 left-5 flex size-8 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_var(--line)]">
              <ArrowDownUp size={15} />
            </div>
            <div className="ml-11 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-ink-2">Fee</span>
                <span className="font-semibold text-good">$0.00</span>
              </div>
              {c.code !== "USD" ? (
                <div className="flex justify-between">
                  <span className="text-ink-2">Rate</span>
                  <span className="num font-semibold">{rate ? `$1 = ${fmtLocal(rate, c.code)}` : "…"}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-ink-2">Arrives</span>
                <span className="font-semibold">In seconds</span>
              </div>
            </div>
          </div>

          <label className="block px-5 pb-5 pt-4">
            <span className="text-[13px] font-semibold text-ink-2">{to.name} gets</span>
            <div className="mt-1 flex items-center gap-3">
              <input
                inputMode="decimal"
                placeholder="0"
                value={local}
                onChange={(e) => onLocal(e.target.value)}
                className="num min-w-0 flex-1 bg-transparent text-[34px] font-extrabold outline-none placeholder:text-ink-3/50"
              />
              <span className="flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1.5 text-[14px] font-bold">
                {c.flag} {c.code}
              </span>
            </div>
          </label>
        </Card>

        <div className="mt-4">
          <Field label="Note (optional)" placeholder="School fees, for Sunday…" value={memo} maxLength={80} onChange={(e) => setMemo(e.target.value)} />
        </div>

        {balance === 0 ? (
          <div className="mt-4">
            <Notice tone="warn">
              Your balance is empty. <Link href="/topup" className="font-semibold underline">Add money</Link> first.
            </Notice>
          </div>
        ) : null}

        <Button className="mt-6 w-full" disabled={!(usdN > 0) || over} onClick={() => setStep("review")}>
          Continue
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------- who
  const list = [...contacts.filter(match)];
  const mates = housemates.filter(match);
  return (
    <div>
      <div className="pt-safe" />
      <PageTitle sub="Money arrives in seconds, with no fee.">Send money</PageTitle>

      <label className="relative mb-4 block">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          placeholder="Search people"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 w-full rounded-2xl bg-surface pl-11 pr-4 text-[16px] shadow-[0_0_0_1px_var(--line)] outline-none focus:shadow-[0_0_0_2px_var(--hearth)]"
        />
      </label>

      <Card pad={false} className="px-4 py-1">
        <Row
          lead={
            <span className="flex size-10 items-center justify-center rounded-full bg-hearth text-white">
              <Plus size={20} />
            </span>
          }
          title="New recipient"
          sub="Family or friends anywhere"
          onClick={() => setAdding(true)}
          chevron
        />
        {list.map((r) => (
          <Row
            key={r.address}
            lead={
              <span className="relative">
                <Avatar name={r.name} />
                <span className="absolute -bottom-0.5 -right-1 text-[15px]">{country(r.corridor).flag}</span>
              </span>
            }
            title={r.name}
            sub={country(r.corridor).name}
            onClick={() => {
              setTo(r);
              setUsd("");
              setLocal("");
              setStep("amount");
            }}
            chevron
          />
        ))}
      </Card>

      {mates.length ? (
        <>
          <p className="mb-1 mt-6 px-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Your house</p>
          <Card pad={false} className="px-4 py-1">
            {mates.map((r) => (
              <Row
                key={r.address}
                lead={<Avatar name={r.name} />}
                title={r.name}
                sub="Housemate"
                onClick={() => {
                  setTo(r);
                  setUsd("");
                  setLocal("");
                  setStep("amount");
                }}
                chevron
              />
            ))}
          </Card>
        </>
      ) : null}

      <p className="mt-6 px-2 text-center text-[12.5px] text-ink-3">People you add are saved to your account, encrypted, so only you can see them on any phone.</p>

      <Sheet open={adding} onClose={() => setAdding(false)} title="New recipient">
        <div className="space-y-4 pb-4">
          <div>
            <span className="mb-1.5 block px-1 text-[13px] font-semibold text-ink-2">Where do they live?</span>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {countries.map((k) => (
                <button
                  key={k.code}
                  onClick={() => setDraft({ ...draft, corridor: k.code })}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold transition ${draft.corridor === k.code ? "bg-hearth text-white" : "bg-surface shadow-[0_0_0_1px_var(--line)]"}`}
                >
                  <span>{k.flag}</span> {k.name}
                </button>
              ))}
            </div>
          </div>
          <Field label="Name" placeholder="Mama" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Field
            label="Their Vesta address"
            placeholder="Paste from their Vesta app"
            value={draft.address}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setDraft({ ...draft, address: e.target.value.trim() as Address })}
            hint="They'll find it under House → You."
          />
          {save.error ? <Notice tone="error">{save.error}</Notice> : null}
          <Button className="w-full" busy={save.busy} disabled={!isAddress(draft.address) || !draft.name.trim()} onClick={saveContact}>
            Save and continue
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-ink-2">{label}</span>
      <span className="num text-right font-semibold">{value}</span>
    </div>
  );
}
