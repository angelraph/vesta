"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { createAccount, unlock } from "@/lib/account";
import { useAccount } from "@/lib/hooks";
import { setName } from "@/lib/vault";
import { Mark, Wordmark } from "@/components/Logo";
import { Button, Field, Notice, useAction } from "@/components/ui";
import { Landing } from "@/components/Landing";



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
      await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: s.address }),
      }).catch(() => null);
      await setName(s, name.trim());
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
        <Wordmark size={24} />
      </div>

      {step === "name" ? (
        <div className="rise flex flex-1 flex-col justify-center pt-12">
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
          <Landing />
          <div className="cta-dock sticky bottom-0 -mx-6 space-y-3 px-6 pb-2 pt-8">
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button
              className="w-full"
              onClick={() => {
                window.scrollTo({ top: 0 });
                setStep("name");
              }}
            >
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
