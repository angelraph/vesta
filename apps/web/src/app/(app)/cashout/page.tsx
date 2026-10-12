"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, Landmark, Send } from "lucide-react";
import { useSession } from "@/lib/hooks";
import { useFx } from "@/lib/house";
import { explorerTx } from "@/lib/config";
import { convertReceived, getBalances } from "@/lib/vault";
import { Button, Card, CountUp, IconBubble, Notice, SectionTitle, Skeleton, SuccessMark, TopBar, useAction } from "@/components/ui";

const LOCAL = [
  { code: "NGN", sign: "₦" },
  { code: "GHS", sign: "GH₵" },
  { code: "KES", sign: "KSh" },
] as const;

export default function CashOut() {
  const s = useSession();
  const fx = useFx();
  const [received, setReceived] = useState<number | null>(null);
  const [done, setDone] = useState<{ usd: number; hash: string } | null>(null);
  const { busy, error, run } = useAction();

  const load = useCallback(() => {
    if (!s) return;
    getBalances(s.address).then((b) => setReceived(b.received)).catch(() => setReceived(0));
  }, [s]);
  useEffect(load, [load]);

  if (!s) return null;

  const convert = () =>
    run(async () => {
      const r = await convertReceived(s);
      setDone({ usd: r.usd, hash: r.hash });
      load();
    });

  return (
    <div className="space-y-6">
      <TopBar title="Cash out" back="/home" />

      <section className="px-1 text-center">
        <p className="text-[14px] font-medium text-ink-2">Received from abroad</p>
        {received === null ? (
          <Skeleton className="mx-auto mt-2 h-11 w-40" />
        ) : (
          <p className="mt-1 text-[46px] font-extrabold leading-none tracking-[-0.03em]">
            <CountUp value={received} />
          </p>
        )}
        {received && fx ? (
          <p className="num mt-2 text-[14px] text-ink-2">
            {LOCAL.map((l) => `≈ ${l.sign}${Math.round(received * (fx.rates[l.code] ?? 0)).toLocaleString("en-GB")}`).join("  ·  ")}
          </p>
        ) : null}
      </section>

      {done ? (
        <Card className="rise flex flex-col items-center text-center">
          <SuccessMark size={64} />
          <p className="mt-3 text-[18px] font-bold">${done.usd.toFixed(2)} is in your balance</p>
          <p className="mt-1 text-[14px] text-ink-2">Converted through Agora, instantly. You can spend it, send it or split with it now.</p>
          <a href={explorerTx(done.hash)} target="_blank" rel="noreferrer" className="mt-3 text-[13px] font-semibold text-hearth underline">
            Check it on the explorer
          </a>
        </Card>
      ) : null}

      <div>
        <SectionTitle>Use it in Vesta</SectionTitle>
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <IconBubble tone="good">
              <ArrowDownUp size={18} />
            </IconBubble>
            <div>
              <p className="font-semibold">Convert to dollars</p>
              <p className="mt-0.5 text-[13.5px] text-ink-2">
                Move it into your Vesta balance at the same rate it arrived, with no fee. Then pay, send or split with it like any other money.
              </p>
            </div>
          </div>
          <Button className="w-full" busy={busy} disabled={!received} onClick={convert}>
            {received ? `Convert $${received.toFixed(2)}` : "Nothing to convert yet"}
          </Button>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Link href="/send" className="flex items-center justify-center gap-2 text-[14px] font-semibold text-ink-2">
            <Send size={15} /> Or send money to someone
          </Link>
        </Card>
      </div>

      <div>
        <SectionTitle>To a bank or mobile money</SectionTitle>
        <Card className="flex items-start gap-3">
          <IconBubble tone="ember">
            <Landmark size={18} />
          </IconBubble>
          <div>
            <p className="font-semibold">Coming when Vesta launches</p>
            <p className="mt-0.5 text-[13.5px] text-ink-2">
              Payouts to banks and mobile money in Nigeria, Ghana and Kenya, through a licensed local payout partner. Vesta runs on a test network today, so there&apos;s no real bank on the other end yet, and we won&apos;t pretend there is.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
