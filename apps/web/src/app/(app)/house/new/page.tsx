"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "viem";
import { useSession } from "@/lib/hooks";
import { createHouse } from "@/lib/vault";
import { Button, Field, Notice, PageTitle, TopBar, cleanAmount, useAction } from "@/components/ui";

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
      } catch {}
      router.replace("/house");
    });
  }

  return (
    <div>
      <TopBar back="/home" />
      <PageTitle sub="Takes a minute. You can invite everyone straight after.">Set up your house</PageTitle>
      <div className="space-y-4">
        <Field label="House name" placeholder="12 Amhurst Road" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
        <Field
          label="Monthly rent for the whole house"
          inputMode="decimal"
          placeholder="$2,400"
          value={rent}
          onChange={(e) => setRent(cleanAmount(e.target.value))}
          hint="In US dollars. Split evenly between everyone in the house."
        />
        <Field label="First rent day" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Field
          label="Who gets paid"
          placeholder="Landlord or agent's Vesta address"
          value={landlord}
          onChange={(e) => setLandlord(e.target.value.trim())}
          hint="The pot pays out here on rent day, once it's full."
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {s && landlord.toLowerCase() !== s.address.toLowerCase() ? (
          <button type="button" onClick={() => setLandlord(s.address)} className="-mt-2 text-[13px] font-semibold text-hearth">
            I collect the rent myself (use my address)
          </button>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button className="w-full" disabled={!valid} busy={busy} onClick={onCreate}>
          Create house
        </Button>
      </div>
    </div>
  );
}
