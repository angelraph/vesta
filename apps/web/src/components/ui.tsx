"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

// ---------------------------------------------------------------- buttons

export function Button({
  variant = "primary",
  size = "lg",
  busy,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ember" | "secondary" | "ghost" | "danger";
  size?: "lg" | "md" | "sm";
  busy?: boolean;
}) {
  const styles = {
    primary: "bg-hearth text-white hover:bg-hearth-2",
    ember: "bg-ember text-white hover:brightness-[0.97]",
    secondary: "bg-sunken text-ink hover:bg-line/70",
    ghost: "text-hearth hover:bg-hearth-tint",
    danger: "bg-bad-tint text-bad hover:brightness-95",
  }[variant];
  const sizes = { lg: "h-14 px-6 text-[16px] rounded-2xl", md: "h-11 px-5 text-[15px] rounded-xl", sm: "h-9 px-3.5 text-[13px] rounded-full" }[size];
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex select-none items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${sizes} ${className}`}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span className={`${className} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`} aria-hidden />;
}

/** Round icon button with a label underneath, like a banking app's quick actions. */
export function QuickAction({ href, onClick, icon, label, tone = "neutral" }: { href?: string; onClick?: () => void; icon: ReactNode; label: string; tone?: "neutral" | "ember" | "hearth" }) {
  const circle = {
    neutral: "bg-surface text-ink border border-line",
    ember: "bg-ember text-white",
    hearth: "bg-hearth text-white",
  }[tone];
  const inner = (
    <>
      <span className={`flex size-[52px] items-center justify-center rounded-full transition group-active:scale-95 ${circle}`}>{icon}</span>
      <span className="text-[12.5px] font-semibold text-ink">{label}</span>
    </>
  );
  const cls = "group flex flex-col items-center gap-2";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

// ------------------------------------------------------------------ layout

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={`rounded-[24px] bg-surface ${pad ? "p-5" : ""} shadow-[0_1px_2px_rgba(15,31,26,0.04),0_0_0_1px_rgba(15,31,26,0.04)] ${className}`}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function TopBar({ title, back, right, onBack }: { title?: string; back?: string; right?: ReactNode; onBack?: () => void }) {
  const backBtn = (
    <span className="flex size-10 items-center justify-center rounded-full bg-surface shadow-[0_0_0_1px_rgba(15,31,26,0.06)]">
      <ChevronLeft size={20} />
    </span>
  );
  return (
    <div className="pt-safe flex h-[68px] items-center justify-between gap-3 pb-2">
      <div className="w-10">
        {onBack ? (
          <button onClick={onBack} aria-label="Back">
            {backBtn}
          </button>
        ) : back ? (
          <Link href={back} aria-label="Back">
            {backBtn}
          </Link>
        ) : null}
      </div>
      {title ? <h1 className="flex-1 text-center text-[17px] font-bold">{title}</h1> : <span className="flex-1" />}
      <div className="flex w-10 justify-end">{right}</div>
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5 px-1">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{children}</h1>
      {sub ? <p className="mt-1 text-[15px] text-ink-2">{sub}</p> : null}
    </div>
  );
}

/** A row in a list: leading visual, two lines of text, trailing value. */
export function Row({
  lead,
  title,
  sub,
  trail,
  trailSub,
  href,
  onClick,
  chevron,
}: {
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  trailSub?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <>
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{title}</p>
        {sub ? <p className="truncate text-[13px] text-ink-2">{sub}</p> : null}
      </div>
      {trail !== undefined ? (
        <div className="text-right">
          <div className="num text-[15px] font-semibold">{trail}</div>
          {trailSub ? <div className="text-[12px] text-ink-3">{trailSub}</div> : null}
        </div>
      ) : null}
      {chevron ? <ChevronRight size={18} className="text-ink-3" /> : null}
    </>
  );
  const cls = "flex w-full items-center gap-3.5 px-1 py-3 text-left";
  if (href)
    return (
      <Link href={href} className={`${cls} rounded-2xl transition hover:bg-sunken/60`}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button onClick={onClick} className={`${cls} rounded-2xl transition hover:bg-sunken/60`}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-line ${className}`} />;
}

// ------------------------------------------------------------------- money

export function Money({ value, className = "", cents = true }: { value: number; className?: string; cents?: boolean }) {
  const [whole, frac] = Math.abs(value)
    .toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(".");
  return (
    <span className={`num ${className}`}>
      {value < 0 ? "−" : ""}${whole}
      {cents ? <span className="opacity-60">.{frac}</span> : null}
    </span>
  );
}

// ------------------------------------------------------------------ inputs

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-semibold text-ink-2">{label}</span>
      <input
        {...props}
        className="h-[52px] w-full rounded-2xl bg-surface px-4 text-[16px] shadow-[0_0_0_1px_var(--line)] outline-none transition placeholder:text-ink-3 focus:shadow-[0_0_0_2px_var(--hearth)]"
      />
      {hint ? <span className="mt-1.5 block px-1 text-[12.5px] text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function cleanAmount(v: string) {
  return v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").replace(/^(\d*\.\d{0,2}).*$/, "$1");
}

// ----------------------------------------------------------------- avatars

const hues = ["#0f4c3a", "#e97f23", "#7a5c3e", "#2f6f8f", "#8a3b5a", "#4f6b2f", "#5b4a9e"];
export function Avatar({ name, size = 40, ring }: { name: string; size?: number; ring?: boolean }) {
  const initials = name
    .replace(/^0x/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${ring ? "ring-[3px] ring-surface" : ""}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function IconBubble({ children, tone = "neutral", size = 40 }: { children: ReactNode; tone?: "neutral" | "good" | "ember" | "hearth"; size?: number }) {
  const t = { neutral: "bg-sunken text-ink", good: "bg-hearth-tint text-good", ember: "bg-ember-tint text-ember", hearth: "bg-hearth-tint text-hearth" }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${t}`} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- feedback

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn"; children: ReactNode }) {
  const styles = { info: "bg-hearth-tint text-hearth", error: "bg-bad-tint text-bad", warn: "bg-ember-tint text-warn" }[tone];
  return <div className={`rounded-2xl px-4 py-3 text-[14px] leading-snug ${styles}`}>{children}</div>;
}

export function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      <IconBubble size={52}>{icon}</IconBubble>
      <p className="mt-3 font-semibold">{title}</p>
      {children ? <p className="mt-1 text-[14px] text-ink-2">{children}</p> : null}
    </div>
  );
}

export function SuccessMark({ size = 88 }: { size?: number }) {
  return (
    <span className="pop inline-flex items-center justify-center rounded-full bg-good text-white" style={{ width: size, height: size }}>
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="draw" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/** Bottom sheet for focused tasks on phones; a centred dialog on wider screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="sheet pb-safe relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-bg px-5 pt-3 md:rounded-[28px]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[19px] font-bold">{title}</h2>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-full bg-sunken" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      const { friendlyError } = await import("@/lib/account");
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
