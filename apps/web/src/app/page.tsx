"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Fingerprint, Home, Send, SplitSquareHorizontal } from "lucide-react";
import { createAccount, unlock } from "@/lib/account";
import { useAccount } from "@/lib/hooks";
import { setName } from "@/lib/vault";
import { Mark } from "@/components/Logo";
import { Button, Field, Notice, useAction } from "@/components/ui";

const points = [
  { Icon: Home, title: "Rent that fills itself", sub: "Everyone pays into one pot. The landlord gets paid on the day." },
  { Icon: SplitSquareHorizontal, title: "Splits without the chasing", sub: "Add the dinner, everyone settles with a tap." },
  { Icon: Send, title: "Money home in seconds", sub: "To Lagos, Accra or Nairobi. No fee." },
];

export default function Welcome() {
  const account = useAccount();
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "name">("intro");
  const [name, setNameInput] = useState("");
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (account.status === "unlocked") router.replace("/home");
  }, [account.status, router]);

  const onCreate = () =>
    run(async () => {
      const s = await createAccount(name.trim());
      await setName(s, name.trim());
      await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: s.address }),
      }).catch(() => null);
      router.replace("/home");
    });

  const onUnlock = () =>
    run(async () => {
      await unlock();
      router.replace("/home");
    });

  const returning = account.status === "locked";

  if (returning) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Mark size={64} animated />
          <h1 className="mt-7 font-display text-[36px] font-semibold tracking-tight">Welcome home.</h1>
          <p className="mt-2 text-ink-2">Unlock with your face or fingerprint.</p>
        </div>
        <div className="space-y-3">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button className="w-full" busy={busy} onClick={onUnlock}>
            <Fingerprint size={20} /> Unlock Vesta
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
      <div className="flex items-center gap-2 pt-2">
        <Mark size={30} />
        <span className="font-display text-[22px] font-semibold text-hearth">Vesta</span>
      </div>

      {step === "name" ? (
        <div className="rise flex flex-1 flex-col justify-center">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">What should your housemates call you?</h1>
          <p className="mt-2 text-ink-2">This is the name people in your house see.</p>
          <div className="mt-8">
            <Field label="Your name" placeholder="Amina" autoFocus maxLength={32} value={name} onChange={(e) => setNameInput(e.target.value)} />
          </div>
          <div className="mt-auto space-y-3 pt-10">
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button className="w-full" busy={busy} disabled={name.trim().length < 2} onClick={onCreate}>
              <Fingerprint size={20} /> Create with passkey
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep("intro")}>
              Back
            </Button>
            <p className="text-center text-[12.5px] text-ink-3">Your phone asks for Face ID or your fingerprint. That&apos;s your whole account.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-center py-10">
            <h1 className="font-display text-[44px] font-semibold leading-[1.02] tracking-tight">
              Money for the people you live with.
            </h1>
            <ul className="mt-9 space-y-5">
              {points.map(({ Icon, title, sub }) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-hearth shadow-[0_0_0_1px_rgba(15,31,26,0.06)]">
                    <Icon size={20} />
                  </span>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-[14px] text-ink-2">{sub}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button className="w-full" onClick={() => setStep("name")}>
              Get started
            </Button>
            <Button variant="secondary" className="w-full" busy={busy} onClick={onUnlock}>
              I already have Vesta
            </Button>
            <p className="pt-1 text-center text-[12.5px] text-ink-3">No password, no email, nothing to write down.</p>
          </div>
        </>
      )}
    </main>
  );
}
