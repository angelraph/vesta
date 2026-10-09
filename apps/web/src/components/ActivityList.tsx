"use client";

import { ArrowDownLeft, ArrowUpRight, Home, Receipt, UserPlus, AlertCircle, Landmark, Clock } from "lucide-react";
import type { Address } from "viem";
import { dayLabel, type Activity } from "@/lib/activity";
import { fromUnits, short } from "@/lib/vault";
import { Avatar, Empty, IconBubble, Money, Row, Skeleton } from "./ui";

const flags: Record<string, string> = { NGN: "🇳🇬", GHS: "🇬🇭", KES: "🇰🇪", ZAR: "🇿🇦", GBP: "🇬🇧", EUR: "🇪🇺" };

export function ActivityList({
  items,
  me,
  names,
  loading,
  unavailable,
}: {
  items: Activity[] | null;
  me: Address;
  names: Record<string, string>;
  loading?: boolean;
  unavailable?: boolean;
}) {
  if (unavailable) {
    return (
      <Empty icon={<Clock size={22} />} title="History is on its way">
        Payments go through right away. The full history list switches on shortly.
      </Empty>
    );
  }
  if (loading || !items) {
    return (
      <div className="space-y-4 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-1">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Empty icon={<Receipt size={22} />} title="Nothing yet">
        Rent, splits and money you send will show up here.
      </Empty>
    );
  }

  const mine = me.toLowerCase();
  const nameOf = (a: string | null) => (a ? (a.toLowerCase() === mine ? "You" : names[a.toLowerCase()] ?? short(a)) : "");
  const days = items.map((a) => dayLabel(a.timestamp));

  return (
    <div>
      {items.map((a, i) => {
        const header = i === 0 || days[i] !== days[i - 1] ? days[i] : null;
        const amt = fromUnits(BigInt(a.amount || "0"));
        const fromMe = a.actor.toLowerCase() === mine;
        const time = new Date(a.timestamp * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        let lead = <Avatar name={nameOf(a.actor)} />;
        let title = "";
        let sub = time;
        let trail: React.ReactNode = <Money value={-amt} />;

        switch (a.kind) {
          case "sent":
            lead = (
              <span className="relative">
                <Avatar name={nameOf(a.counterparty)} />
                <span className="absolute -bottom-0.5 -right-1 text-[14px]">{flags[a.corridor ?? ""] ?? ""}</span>
              </span>
            );
            title = fromMe ? nameOf(a.counterparty) : `From ${nameOf(a.actor)}`;
            sub = a.memo ? `${a.memo} · ${time}` : `Sent home · ${time}`;
            trail = fromMe ? <Money value={-amt} /> : <span className="text-good"><Money value={amt} /></span>;
            break;
          case "settle":
            title = fromMe ? `Paid ${nameOf(a.counterparty)} back` : `${nameOf(a.actor)} paid you back`;
            trail = fromMe ? <Money value={-amt} /> : <span className="text-good"><Money value={amt} /></span>;
            lead = <IconBubble tone={fromMe ? "neutral" : "good"}>{fromMe ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</IconBubble>;
            break;
          case "rent":
            title = fromMe ? "Rent pot" : `${nameOf(a.actor)} paid rent`;
            sub = `Rent share · ${time}`;
            lead = <IconBubble tone="hearth"><Home size={18} /></IconBubble>;
            trail = fromMe ? <Money value={-amt} /> : <span className="text-ink-2"><Money value={amt} /></span>;
            break;
          case "collect":
            title = "Rent paid to landlord";
            lead = <IconBubble tone="good"><Landmark size={18} /></IconBubble>;
            trail = <span className="text-ink-2"><Money value={amt} /></span>;
            break;
          case "expense":
            title = a.memo || "Shared cost";
            sub = `${nameOf(a.actor)} paid · ${time}`;
            lead = <IconBubble tone="ember"><Receipt size={18} /></IconBubble>;
            trail = <span className="text-ink-2"><Money value={amt} /></span>;
            break;
          case "joined":
            title = `${nameOf(a.actor)} moved in`;
            lead = <IconBubble><UserPlus size={18} /></IconBubble>;
            trail = null;
            break;
          case "created":
            title = `${nameOf(a.actor)} set up the house`;
            lead = <IconBubble tone="hearth"><Home size={18} /></IconBubble>;
            trail = null;
            break;
          case "shortfall":
            title = `${nameOf(a.actor)} is short on rent`;
            lead = <IconBubble tone="ember"><AlertCircle size={18} /></IconBubble>;
            trail = <span className="text-warn"><Money value={amt} /></span>;
            break;
        }

        return (
          <div key={a.id} className="cascade" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
            {header ? <p className="px-1 pb-1 pt-4 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3 first:pt-1">{header}</p> : null}
            <Row lead={lead} title={title} sub={sub} trail={trail} href={a.kind === "sent" ? `/r/${a.txHash}` : undefined} />
          </div>
        );
      })}
    </div>
  );
}
