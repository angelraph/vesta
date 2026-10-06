"use client";

import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { explorerTx } from "@/lib/config";

export function Button({
  variant = "primary",
  busy,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ember" | "ghost" | "quiet"; busy?: boolean }) {
  const styles = {
    primary: "bg-hearth text-cream hover:bg-hearth-deep",
    ember: "bg-ember text-white hover:brightness-95",
    ghost: "border border-line bg-paper text-ink hover:bg-cream",
    quiet: "text-hearth hover:bg-leaf",
  }[variant];
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50 ${styles} ${className}`}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-paper p-5 shadow-[0_1px_0_rgba(14,42,34,0.04)] ${className}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-[16px] outline-none transition placeholder:text-muted/60 focus:border-hearth focus:ring-4 focus:ring-hearth/10"
      />
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function AmountField({
  value,
  onChange,
  label = "Amount",
  hint,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  hint?: ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex items-baseline gap-1 rounded-2xl border border-line bg-paper px-4 py-3 focus-within:border-hearth focus-within:ring-4 focus-within:ring-hearth/10">
        <span className="font-display text-3xl text-muted">$</span>
        <input
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
          className="num w-full bg-transparent font-display text-3xl outline-none placeholder:text-muted/40"
        />
      </div>
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const styles = {
    info: "bg-leaf text-hearth",
    error: "bg-[#fbe5df] text-danger",
    ok: "bg-leaf text-hearth",
  }[tone];
  return <div className={`rounded-2xl px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Done({ title, hash, children }: { title: string; hash?: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-hearth p-5 text-cream">
      <p className="font-display text-xl">{title}</p>
      {children ? <div className="mt-1 text-sm text-cream/80">{children}</div> : null}
      {hash ? (
        <a href={explorerTx(hash)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-cream/70 underline">
          View receipt on the network
        </a>
      ) : null}
    </div>
  );
}

export function Header({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <div className="pt-safe flex items-center justify-between gap-3 pb-4">
      <div className="flex items-center gap-2">
        {back ? (
          <Link href={back} className="-ml-2 rounded-full p-2 text-muted hover:bg-leaf" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        ) : null}
        <h1 className="font-display text-[26px] font-semibold tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.replace(/^0x/, "").slice(0, 1).toUpperCase();
  const hues = ["#0f4c3a", "#ef8a2b", "#7a5c3e", "#2f6f8f", "#8a3b5a", "#4f6b2f"];
  const bg = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initials}
    </span>
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
