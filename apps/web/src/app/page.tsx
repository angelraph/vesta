"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createAccount, unlock } from "@/lib/account";
import { useAccount } from "@/lib/hooks";
import { getName, setName } from "@/lib/vault";
import { Mark } from "@/components/Logo";
import { Button, Field, Notice, useAction } from "@/components/ui";

export default function Welcome() {
  const account = useAccount();
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "name">("intro");
  const [name, setNameInput] = useState("");
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (account.status === "unlocked") router.replace("/home");
  }, [account.status, router]);

  async function onCreate() {
    await run(async () => {
      const s = await createAccount(name.trim());
      // First onchain action: the name your housemates will see.
      await setName(s, name.trim());
      await fetch("/api/starter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: s.address }),
      }).catch(() => null);
      router.replace("/home");
    });
  }

  async function onUnlock() {
    await run(async () => {
      const s = await unlock();
      const existing = await getName(s.address).catch(() => "");
      router.replace(existing ? "/home" : "/home?new=1");
    });
  }

  const returning = account.status === "locked";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <Mark size={64} animated />
        <h1 className="mt-8 font-display text-[40px] font-semibold leading-[1.05] tracking-tight text-ink">
          {returning ? "Welcome home." : "Money for the people you live with."}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          {returning
            ? "Unlock with your face or fingerprint."
            : "Rent that fills itself up. Dinner that settles with one tap. Money home to family in a second."}
        </p>

        {step === "name" && !returning ? (
          <div className="mt-10 space-y-4">
            <Field
              label="What should your housemates call you?"
              placeholder="Amina"
              autoFocus
              maxLength={32}
              value={name}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <Button className="w-full" busy={busy} disabled={name.trim().length < 2} onClick={onCreate}>
              Continue with passkey
            </Button>
            <Button variant="quiet" className="w-full" onClick={() => setStep("intro")}>
              Back
            </Button>
          </div>
        ) : (
          <div className="mt-10 space-y-3">
            {returning ? (
              <Button className="w-full" busy={busy} onClick={onUnlock}>
                Unlock Vesta
              </Button>
            ) : (
              <Button className="w-full" onClick={() => setStep("name")}>
                Create your account
              </Button>
            )}
            <Button variant="ghost" className="w-full" busy={busy && !returning} onClick={onUnlock}>
              {returning ? "Use a different passkey" : "I already use Vesta"}
            </Button>
          </div>
        )}

        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
      </div>

      <p className="pb-2 text-center text-xs leading-relaxed text-muted">
        No password, no email, nothing to write down.
        <br />
        Your passkey is your account on every phone you use.
      </p>
    </main>
  );
}
