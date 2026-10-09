"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Brain, Check, Copy, Share2, Sparkles, X } from "lucide-react";
import { useSession } from "@/lib/hooks";
import { useHome } from "@/lib/house";
import { signStewardAuth } from "@/lib/stewardAuth";
import { fromUnits, payRent, readMemory, usdText, writeMemory, type StewardMemory } from "@/lib/vault";
import { Button, Notice, Sheet, Spinner, TopBar } from "@/components/ui";
import { Mark } from "@/components/Logo";

type Card =
  | { type: "action"; action: "pay_rent" | "settle" | "send_home"; amount?: number; to?: string; label: string }
  | { type: "message"; to: string; text: string }
  | { type: "remember"; fact: string };

type Msg = { role: "user" | "assistant"; content: string; cards?: Card[] };

const starters = ["Who still owes rent this month?", "Am I square with everyone?", "How much have I sent home lately?", "What's $100 in naira today?"];

export default function Steward() {
  const s = useSession();
  const router = useRouter();
  const { view, current, balances, refresh } = useHome(s);
  const [memory, setMemory] = useState<StewardMemory | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [doing, setDoing] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (s) readMemory(s).then(setMemory).catch(() => setMemory({ facts: [] }));
  }, [s]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, thinking]);

  if (!s) return null;
  const me = view?.me;

  async function remember(facts: string[]) {
    if (!s || facts.length === 0) return;
    const base = memory ?? { facts: [] };
    const next: StewardMemory = { ...base, facts: [...base.facts, ...facts.filter((f) => !base.facts.includes(f))].slice(-30) };
    setMemory(next);
    // Sealed to the passkey before it leaves the phone.
    writeMemory(s, next).catch(() => null);
  }

  async function ask(question: string) {
    if (!s || !question.trim() || thinking) return;
    const history: Msg[] = [...msgs, { role: "user", content: question.trim() }];
    setMsgs(history);
    setText("");
    setThinking(true);
    setError(null);
    try {
      const auth = await signStewardAuth(s.wallet, s.address);
      const res = await fetch("/api/steward", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: s.address,
          houseId: current?.toString() ?? null,
          name: me?.name ?? "",
          memory: memory?.facts ?? [],
          messages: history.map(({ role, content }) => ({ role, content })),
          auth,
        }),
      });
      const data = (await res.json()) as { reply?: string; cards?: Card[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "The steward couldn't answer.");
      const cards = data.cards ?? [];
      setMsgs([...history, { role: "assistant", content: data.reply || "Done.", cards }]);
      await remember(cards.filter((c): c is Extract<Card, { type: "remember" }> => c.type === "remember").map((c) => c.fact));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMsgs(history);
    } finally {
      setThinking(false);
    }
  }

  async function act(card: Extract<Card, { type: "action" }>) {
    if (card.action === "send_home") return router.push("/send");
    if (card.action === "settle") return router.push("/split");
    if (!view || !me) return;
    const left = view.sharePerMember > me.rentPaid ? view.sharePerMember - me.rentPaid : 0n;
    if (left === 0n) return setError("You're already paid up this month.");
    const wallet = balances?.ausd ?? 0n;
    const pay = left > wallet ? wallet : left;
    if (pay === 0n) return setError(`Your share is ${usdText(left)} but your balance is $0.00. Add money on Home first.`);
    setDoing(card.label);
    try {
      await payRent(s!, view.house.id, String(fromUnits(pay)));
      await refresh();
      const note = pay < left ? `Done. ${usdText(pay)} is in the rent pot, ${usdText(left - pay)} still to go.` : `Done. Your share is in the rent pot.`;
      setMsgs((m) => [...m, { role: "assistant", content: note }]);
    } catch (e) {
      const { friendlyError } = await import("@/lib/account");
      setError(friendlyError(e));
    } finally {
      setDoing(null);
    }
  }

  async function forget(fact: string) {
    if (!s || !memory) return;
    const next = { ...memory, facts: memory.facts.filter((f) => f !== fact) };
    setMemory(next);
    writeMemory(s, next).catch(() => null);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Steward"
        back="/home"
        right={
          <button onClick={() => setShowMemory(true)} className="flex size-10 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_rgba(15,31,26,0.06)]" aria-label="What the steward remembers">
            <Brain size={18} />
          </button>
        }
      />

      <div className="flex-1 space-y-4 pb-36">
        {msgs.length === 0 ? (
          <div className="rise flex flex-col items-center px-4 pt-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_rgba(15,31,26,0.06)]">
              <Mark size={34} animated />
            </span>
            <h2 className="mt-4 text-[22px] font-extrabold tracking-tight">Hi{me ? ` ${me.name}` : ""}, I keep an eye on the house.</h2>
            <p className="mt-1.5 max-w-xs text-[14.5px] text-ink-2">Ask me who&apos;s paid, what&apos;s due, or what you&apos;ve sent home. I can&apos;t move money, but I can set it up for you.</p>
            <div className="mt-6 flex w-full flex-col gap-2">
              {starters.map((q) => (
                <button key={q} onClick={() => ask(q)} className="rounded-2xl bg-surface px-4 py-3 text-left text-[14.5px] font-medium shadow-[0_0_0_1px_rgba(15,31,26,0.05)] transition hover:bg-sunken">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="rise flex justify-end">
              <p className="max-w-[82%] rounded-[20px] rounded-br-md bg-hearth px-4 py-2.5 text-[15px] text-white">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="rise flex gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_rgba(15,31,26,0.06)]">
                <Mark size={18} />
              </span>
              <div className="min-w-0 max-w-[85%] space-y-2">
                <p className="whitespace-pre-wrap rounded-[20px] rounded-tl-md bg-surface px-4 py-2.5 text-[15px] leading-relaxed shadow-[0_0_0_1px_rgba(15,31,26,0.04)]">{m.content}</p>
                {m.cards?.map((c, j) =>
                  c.type === "action" ? (
                    <Button key={j} size="md" variant={c.action === "send_home" ? "ember" : "primary"} busy={doing === c.label} onClick={() => act(c)}>
                      {c.label}
                    </Button>
                  ) : c.type === "message" ? (
                    <div key={j} className="rounded-2xl bg-ember-tint p-3.5">
                      <p className="text-[12px] font-bold uppercase tracking-wide text-warn">Message for {c.to}</p>
                      <p className="mt-1 text-[14.5px]">{c.text}</p>
                      <div className="mt-2.5 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => (navigator.share ? navigator.share({ text: c.text }).catch(() => null) : navigator.clipboard.writeText(c.text))}
                        >
                          <Share2 size={14} /> Send
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(c.text);
                            setCopied(i * 10 + j);
                            setTimeout(() => setCopied(null), 1500);
                          }}
                        >
                          {copied === i * 10 + j ? <Check size={14} /> : <Copy size={14} />} Copy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p key={j} className="flex items-center gap-1.5 px-1 text-[12.5px] text-ink-3">
                      <Brain size={13} /> Remembered: {c.fact}
                    </p>
                  ),
                )}
              </div>
            </div>
          ),
        )}

        {thinking ? (
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_rgba(15,31,26,0.06)]">
              <Mark size={18} animated />
            </span>
            <span className="flex items-center gap-2 rounded-[20px] bg-surface px-4 py-2.5 text-[14px] text-ink-2">
              <Spinner className="size-3.5" /> Checking the house…
            </span>
          </div>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line/70 bg-bg/90 px-4 pt-3 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-md items-center gap-2 md:max-w-xl">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask about rent, splits, money home…"
            className="h-12 flex-1 rounded-full bg-surface px-5 text-[16px] shadow-[0_0_0_1px_var(--line)] outline-none focus:shadow-[0_0_0_2px_var(--hearth)]"
          />
          <button
            type="submit"
            disabled={!text.trim() || thinking}
            className="flex size-12 items-center justify-center rounded-full bg-hearth text-white transition disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp size={20} />
          </button>
        </div>
      </form>

      <Sheet open={showMemory} onClose={() => setShowMemory(false)} title="What I remember">
        <div className="space-y-3 pb-4">
          <p className="text-[14px] text-ink-2">
            Little things that help me help you. They&apos;re locked to your passkey, so they follow you to any phone and nobody else can read them.
          </p>
          {memory?.facts.length ? (
            <ul className="divide-y divide-line rounded-2xl bg-surface">
              {memory.facts.map((f) => (
                <li key={f} className="flex items-center gap-3 px-4 py-3">
                  <Sparkles size={15} className="shrink-0 text-ember" />
                  <span className="flex-1 text-[14.5px]">{f}</span>
                  <button onClick={() => forget(f)} className="flex size-8 items-center justify-center rounded-full hover:bg-sunken" aria-label={`Forget ${f}`}>
                    <X size={15} className="text-ink-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-surface px-4 py-6 text-center text-[14px] text-ink-3">Nothing yet.</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}
