"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { House, Fingerprint, Send, SplitSquareHorizontal, Users } from "lucide-react";
import { unlock } from "@/lib/account";
import { useAccount } from "@/lib/hooks";
import { Mark } from "./Logo";
import { Button, Notice, useAction } from "./ui";

const tabs = [
  { href: "/home", label: "Home", Icon: House },
  { href: "/send", label: "Send", Icon: Send },
  { href: "/split", label: "Split", Icon: SplitSquareHorizontal },
  { href: "/house", label: "House", Icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const account = useAccount();
  const router = useRouter();
  const path = usePathname();
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (account.status === "signedOut") router.replace("/");
  }, [account.status, router]);

  if (account.status === "loading" || account.status === "signedOut") {
    return <div className="min-h-dvh" />;
  }

  if (account.status === "locked") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Mark size={56} animated />
          <h1 className="mt-6 text-[26px] font-extrabold tracking-tight">Vesta is locked</h1>
          <p className="mt-2 max-w-xs text-ink-2">It locks itself after 15 minutes without use. Unlock to carry on.</p>
        </div>
        <div className="space-y-3">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button className="w-full" busy={busy} onClick={() => run(unlock)}>
            <Fingerprint size={20} /> Unlock
          </Button>
        </div>
      </main>
    );
  }

  const hideNav = /^\/(send\/|house\/new|topup|steward|activity)/.test(path);

  return (
    <div className="mx-auto min-h-dvh max-w-md md:max-w-xl">
      <main key={path} className={`page-in px-4 ${hideNav ? "pb-10" : "pb-28"}`}>{children}</main>
      {hideNav ? null : (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/85 backdrop-blur-xl">
          <ul className="mx-auto grid max-w-md grid-cols-4 md:max-w-xl">
            {tabs.map(({ href, label, Icon }) => {
              const active = path === href || path.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link href={href} className={`flex flex-col items-center gap-1 pt-2.5 text-[11.5px] font-semibold transition ${active ? "tab-on text-hearth" : "text-ink-3"}`}>
                    <Icon size={23} strokeWidth={active ? 2.3 : 1.8} />
                    {label}
                    <span className={active ? "tab-dot" : "h-1"} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
