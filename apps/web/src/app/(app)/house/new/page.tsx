"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "viem";
import { useSession } from "@/lib/hooks";
import { createHouse } from "@/lib/vault";
import { Button, Field, Header, Notice, useAction } from "@/components/ui";

function nextFirst() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 9).toISOString().slice(0, 10);
}

export default function NewHouse() {
  const s = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [rent, setRent] = useState("");
  const [landlord, setLandlord] = useState("");
  const [due, setDue] = useState(nextFirst());
  const { busy, error, run } = useAction();

  const valid = name.trim().length > 1 && Number(rent) > 0 && isAddress(landlord) && due;

  async function onCreate() {
    if (!s || !valid) return;
    await run(async () => {
      const res = await createHouse(s, {
        name: name.trim(),
        landlord: landlord as `0x${string}`,
        rentUsd: rent,
        firstDue: new Date(`${due}T09:00:00`),
        periodDays: 30,
      });
      try {
        localStorage.setItem("vesta.house", res.houseId.toString());
        sessionStorage.setItem(`vesta.invite.${res.houseId}`, res.invite);
      } catch {}
      router.replace("/house?created=1");
    });
  }

  return (
    <div>
      <Header title="Set up a house" back="/home" />
      <div className="space-y-4">
        <Field label="House name" placeholder="12 Amhurst Road" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
        <Field
          label="Monthly rent for the whole house, in dollars"
          inputMode="decimal"
          placeholder="2400"
          value={rent}
          onChange={(e) => setRent(e.target.value.replace(/[^0-9.]/g, ""))}
          hint="Everyone's share is split evenly. You can change who's in the house any time by inviting people."
        />
        <Field label="First rent day" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Field
          label="Where rent gets paid"
          placeholder="Landlord or agent's Vesta address"
          value={landlord}
          onChange={(e) => setLandlord(e.target.value.trim())}
          hint="The pot pays out here on rent day, once it's full."
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button className="w-full" disabled={!valid} busy={busy} onClick={onCreate}>
          Create house
        </Button>
      </div>
    </div>
  );
}
