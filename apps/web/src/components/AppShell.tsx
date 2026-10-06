"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { unlock } from "@/lib/account";
import { useAccount } from "@/lib/hooks";
import { Mark } from "./Logo";
import { Button, Notice, useAction } from "./ui";

const tabs = [
  { href: "/home", label: "Home", icon: "M3 11 12 4l9 7v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-8Z" },
  { href: "/split", label: "Split", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/send", label: "Send", icon: "M5 12h14M13 6l6 6-6 6" },
  { href: "/house", label: "House", icon: "M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21a8 8 0 0 1 16 0" },
  { href: "/steward", label: "Steward", icon: "M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 4 0-3 0-5 1-8Z" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const account = useAccount();
  const router = useRouter();
  const path = usePathname();
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (account.status === "signedOut" && !path.startsWith("/join")) router.replace("/");
  }, [account.status, path, router]);

  if (account.status === "loading" || account.status === "signedOut") {
    return <div className="min-h-dvh" />;
  }

  if (account.status === "locked") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-6 px-6">
        <Mark size={52} animated />
        <div>
          <h1 className="font-display text-3xl font-semibold">Vesta is locked</h1>
          <p className="mt-2 text-muted">It locks itself after 15 minutes without use. Unlock with your passkey to carry on.</p>
        </div>
        <Button className="w-full" busy={busy} onClick={() => run(unlock)}>
          Unlock
        </Button>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md md:max-w-2xl">
      <main className="px-5 pb-28 md:px-8">{children}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/90 backdrop-blur-md">
        <ul className="mx-auto grid max-w-md grid-cols-5 md:max-w-2xl">
          {tabs.map((t) => {
            const active = path.startsWith(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={`flex flex-col items-center gap-1 pt-2.5 text-[11px] font-medium ${active ? "text-hearth" : "text-muted"}`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
