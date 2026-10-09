"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Fingerprint, Home, Send, SplitSquareHorizontal, Zap } from "lucide-react";

// The signed-out landing. Revolut's scale and floating cards up top, a Monzo
// style pot that fills itself, and a Wise style live converter for money home.

/** Adds `in` once the element scrolls into view, so CSS can play its entrance. */
function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/** Counts from the last value to `to` whenever it changes. */
function useCountUp(to: number, run: boolean, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!run) return;
    const dur = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = dur === 0 ? 1 : Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(a + (to - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, ms]);
  return v;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className={`reveal ${seen ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const HEADLINE = ["Money", "for", "the", "people", "you", "live", "with."];

function Hero() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const on = () => setY(Math.min(window.scrollY, 400));
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <section className="relative pt-8">
      <h1 className="font-display text-[50px] font-semibold leading-[0.98] tracking-[-0.03em]">
        {HEADLINE.map((w, i) => (
          <span key={w + i}>
            <span className="word-wrap">
              <span className="word" style={{ animationDelay: `${120 + i * 70}ms` }}>
                {w === "live" ? <span className="highlight">{w}</span> : w}
              </span>
            </span>{" "}
          </span>
        ))}
      </h1>
      <p className="fade-up mt-5 max-w-[30ch] text-[17px] text-ink-2" style={{ animationDelay: "700ms" }}>
        Rent, bills and money home in one account the whole house shares.
      </p>

      {/* Floating card stack */}
      <div className="relative mx-auto mt-10 h-[290px] w-full max-w-[340px]" aria-hidden>
        <div className="float-card absolute left-0 top-8 w-[62%] rotate-[-8deg]" style={{ translate: `0 ${y * -0.08}px`, animationDelay: "0s" }}>
          <div className="rounded-[26px] bg-ember p-4 text-white shadow-[0_24px_48px_-20px_rgba(233,127,35,0.7)]">
            <SplitSquareHorizontal size={18} />
            <p className="mt-3 text-[12px] opacity-80">Dinner at Mara&apos;s</p>
            <p className="num text-[22px] font-extrabold">$64.00</p>
            <p className="text-[12px] opacity-80">Split three ways</p>
          </div>
        </div>
        <div className="float-card absolute right-0 top-0 w-[60%] rotate-[7deg]" style={{ translate: `0 ${y * -0.14}px`, animationDelay: "-2s" }}>
          <div className="rounded-[26px] bg-lime p-4 text-hearth shadow-[0_24px_48px_-20px_rgba(15,76,58,0.45)]">
            <Send size={18} />
            <p className="mt-3 text-[12px] opacity-70">To Mama in Lagos</p>
            <p className="num text-[22px] font-extrabold">₦155,000</p>
            <p className="text-[12px] opacity-70">Arrived in 2 seconds</p>
          </div>
        </div>
        <div className="float-card absolute bottom-0 left-1/2 w-[78%]" style={{ translate: `-50% ${y * -0.04}px`, animationDelay: "-4s" }}>
          <div className="rounded-[28px] bg-hearth p-5 text-white shadow-[0_30px_60px_-24px_rgba(15,31,26,0.7)]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] opacity-80">
                <Home size={15} /> 12 Amhurst Road
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">Rent pot</span>
            </div>
            <p className="num mt-3 text-[34px] font-extrabold leading-none">$2,400.00</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="bar-fill h-full rounded-full bg-lime" />
            </div>
            <p className="mt-2 text-[12px] opacity-80">Full. The landlord gets paid on the 1st.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const MATES = [
  { name: "Amina", color: "#e97f23" },
  { name: "Tobi", color: "#15634b" },
  { name: "Mara", color: "#7b5cd6" },
];

function RentPot() {
  const [ref, seen] = useInView<HTMLDivElement>(0.45);
  const [paid, setPaid] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const timers = [0, 1, 2].map((i) => setTimeout(() => setPaid(i + 1), 500 + i * 650));
    return () => timers.forEach(clearTimeout);
  }, [seen]);
  const total = useCountUp(paid * 800, seen, 600);
  const pct = paid / 3;
  const R = 74;
  const C = 2 * Math.PI * R;

  return (
    <section ref={ref} className="mt-20">
      <Reveal>
        <p className="eyebrow">Rent pot</p>
        <h2 className="mt-2 font-display text-[34px] font-semibold leading-[1.05] tracking-tight">Rent that fills itself.</h2>
        <p className="mt-3 text-ink-2">Everyone pays their share into one pot. When it&apos;s full, the landlord gets paid on the day. Nobody has to chase.</p>
      </Reveal>

      <div className="mt-8 rounded-[32px] bg-surface p-6 shadow-[0_0_0_1px_var(--line)]">
        <div className="relative mx-auto size-[180px]">
          <svg viewBox="0 0 180 180" className="size-full -rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="var(--sunken)" strokeWidth="16" />
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke="var(--hearth)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 650ms cubic-bezier(.2,.8,.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="num text-[30px] font-extrabold leading-none">${Math.round(total).toLocaleString("en-GB")}</p>
            <p className="mt-1 text-[13px] text-ink-2">of $2,400</p>
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          {MATES.map((m, i) => (
            <div key={m.name} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-500 ${paid > i ? "bg-hearth-tint" : "bg-sunken"}`}>
              <span className="flex size-9 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ background: m.color }}>
                {m.name[0]}
              </span>
              <span className="flex-1 font-semibold">{m.name}</span>
              {paid > i ? (
                <span className="pop flex items-center gap-1 text-[14px] font-bold text-good">
                  <Check size={16} strokeWidth={3} /> $800
                </span>
              ) : (
                <span className="text-[14px] text-ink-3">$800 due</span>
              )}
            </div>
          ))}
        </div>

        <div className={`mt-4 flex items-center justify-center gap-2 rounded-2xl bg-hearth py-3 text-[15px] font-semibold text-white transition-all duration-500 ${paid === 3 ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
          <Home size={17} /> Landlord paid on the 1st
        </div>
      </div>
    </section>
  );
}

const CORRIDORS = [
  { code: "NGN", symbol: "₦", who: "Mama", city: "Lagos", tone: "#1f8a5b", fallback: 1550 },
  { code: "GHS", symbol: "GH₵", who: "Kofi", city: "Accra", tone: "#c2412b", fallback: 15 },
  { code: "KES", symbol: "KSh", who: "Wanjiru", city: "Nairobi", tone: "#0f1f1a", fallback: 129 },
];

function SendHome() {
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    fetch("/api/fx")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRates(d.rates))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!seen) return;
    const t = setInterval(() => setI((x) => (x + 1) % CORRIDORS.length), 3200);
    return () => clearInterval(t);
  }, [seen]);

  const c = CORRIDORS[i];
  const rate = rates?.[c.code] ?? c.fallback;
  const gets = useCountUp(100 * rate, seen, 800);

  return (
    <section ref={ref} className="mt-20">
      <Reveal>
        <p className="eyebrow">Send home</p>
        <h2 className="mt-2 font-display text-[34px] font-semibold leading-[1.05] tracking-tight">Money home in seconds. No fee.</h2>
        <p className="mt-3 text-ink-2">Send to family in Lagos, Accra or Nairobi at the real exchange rate. It arrives before you put your phone down.</p>
      </Reveal>

      <div className="mt-8 overflow-hidden rounded-[32px] bg-hearth p-5 text-white">
        <div className="rounded-[22px] bg-white p-4 text-ink">
          <p className="text-[13px] text-ink-2">You send</p>
          <div className="mt-1 flex items-center justify-between">
            <p className="num text-[32px] font-extrabold">100.00</p>
            <span className="flex items-center gap-2 rounded-full bg-sunken px-3 py-1.5 text-[14px] font-bold">
              <span className="flex size-6 items-center justify-center rounded-full bg-hearth text-[10px] text-white">$</span> USD
            </span>
          </div>
        </div>

        <div className="relative my-1 flex items-center gap-3 px-4 py-3 text-[13px]">
          <span className="h-full w-px bg-white/25" />
          <div className="space-y-1.5 opacity-90">
            <p className="flex items-center gap-2">
              <Zap size={14} className="text-lime" /> Fee <b className="num ml-auto">$0.00</b>
            </p>
            <p className="num">
              $1 = {c.symbol}
              {rate.toLocaleString("en-GB", { maximumFractionDigits: 2 })} <span className="opacity-70">· live rate</span>
            </p>
          </div>
        </div>

        <div className="rounded-[22px] bg-white p-4 text-ink">
          <p className="text-[13px] text-ink-2">
            {c.who} in {c.city} gets
          </p>
          <div className="mt-1 flex items-center justify-between">
            <p key={c.code} className="num swap-in text-[32px] font-extrabold">
              {Math.round(gets).toLocaleString("en-GB")}
            </p>
            <span key={c.code + "chip"} className="swap-in flex items-center gap-2 rounded-full bg-sunken px-3 py-1.5 text-[14px] font-bold">
              <span className="flex size-6 items-center justify-center rounded-full text-[10px] text-white" style={{ background: c.tone }}>
                {c.symbol.slice(0, 2)}
              </span>
              {c.code}
            </span>
          </div>
        </div>

        {/* London to home, with a dot making the trip */}
        <div className="mt-5 flex items-center gap-3 px-1 text-[12px] font-semibold">
          <span>London</span>
          <div className="route relative h-[2px] flex-1 rounded-full bg-white/20">
            <span className={`route-dot ${seen ? "go" : ""}`} />
          </div>
          <span key={c.city} className="swap-in">
            {c.city}
          </span>
        </div>
        <p className="mt-3 text-center text-[12px] opacity-75">Settled instantly by Agora</p>
      </div>
    </section>
  );
}

const SPLIT = [
  { name: "Amina", owes: "You paid", color: "#e97f23" },
  { name: "Tobi", owes: "$21.33", color: "#15634b" },
  { name: "Mara", owes: "$21.33", color: "#7b5cd6" },
];

function Splits() {
  const [ref, seen] = useInView<HTMLDivElement>(0.5);
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const timers = [1, 2].map((n, k) => setTimeout(() => setSettled(n), 700 + k * 700));
    return () => timers.forEach(clearTimeout);
  }, [seen]);

  return (
    <section ref={ref} className="mt-20">
      <Reveal>
        <p className="eyebrow">Splits</p>
        <h2 className="mt-2 font-display text-[34px] font-semibold leading-[1.05] tracking-tight">Splits without the chasing.</h2>
        <p className="mt-3 text-ink-2">Add the dinner once. Everyone settles with a tap, and the house always knows who owes what.</p>
      </Reveal>

      <div className="mt-8 rounded-[32px] bg-ember-tint p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-ink-2">Dinner at Mara&apos;s</p>
            <p className="num text-[28px] font-extrabold">$64.00</p>
          </div>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-ember text-white">
            <SplitSquareHorizontal size={22} />
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {SPLIT.map((p, i) => {
            const done = i === 0 || settled >= i;
            return (
              <div key={p.name} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
                <span className="flex size-8 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: p.color }}>
                  {p.name[0]}
                </span>
                <span className="flex-1 font-semibold">{p.name}</span>
                {done && i > 0 ? (
                  <span className="pop flex items-center gap-1 text-[14px] font-bold text-good">
                    <Check size={16} strokeWidth={3} /> Settled
                  </span>
                ) : (
                  <span className={`num text-[14px] ${i === 0 ? "text-ink-2" : "font-bold"}`}>{p.owes}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Passkey() {
  return (
    <section className="mt-20 mb-6">
      <Reveal className="rounded-[32px] bg-ink p-6 text-white">
        <span className="pulse-ring flex size-14 items-center justify-center rounded-full bg-lime text-hearth">
          <Fingerprint size={28} />
        </span>
        <h2 className="mt-5 font-display text-[30px] font-semibold leading-[1.08] tracking-tight">Your face is the key.</h2>
        <p className="mt-3 text-white/75">No password, no email, nothing to write down. Lose your phone, and your passkey brings everything back.</p>
      </Reveal>
    </section>
  );
}

export function Landing() {
  return (
    <>
      <Hero />
      <RentPot />
      <SendHome />
      <Splits />
      <Passkey />
    </>
  );
}
