"use client";

import { useCallback, useState } from "react";
import type { Unlocked } from "./account";
import { useLive } from "./hooks";
import { getBalances, getHouse, getMembers, getMyHouses, getName, type House, type Member } from "./vault";

const PICK = "vesta.house";

export type HouseView = { house: House; members: Member[]; sharePerMember: bigint; me: Member | undefined };

export function useHome(s: Unlocked | null) {
  const [picked, setPicked] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PICK);
    } catch {
      return null;
    }
  });

  const houses = useLive(s ? () => getMyHouses(s.address) : null, [s?.address], 15_000);
  const ids = houses.data ?? [];
  const current = ids.find((id) => id.toString() === picked) ?? ids[ids.length - 1];

  const view = useLive<HouseView | null>(
    s && current
      ? async () => {
          const [house, { members, sharePerMember }] = await Promise.all([getHouse(current), getMembers(current)]);
          const me = members.find((m) => m.address.toLowerCase() === s.address.toLowerCase());
          return { house, members, sharePerMember, me };
        }
      : async () => null,
    [s?.address, current?.toString()],
    6_000,
  );

  const balances = useLive(s ? () => getBalances(s.address) : null, [s?.address], 6_000);
  const name = useLive(s ? () => getName(s.address) : null, [s?.address], 5_000);

  const pick = useCallback((id: bigint) => {
    try {
      localStorage.setItem(PICK, id.toString());
    } catch {}
    setPicked(id.toString());
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([houses.refresh(), view.refresh(), balances.refresh()]);
  }, [houses, view, balances]);

  return {
    loading: houses.data === null,
    houseIds: ids,
    current,
    view: view.data,
    balances: balances.data,
    name: name.data || null,
    nameMissing: name.data === "",
    refreshName: name.refresh,
    pick,
    refresh,
  };
}

export type Fx = { rates: Record<string, number>; at: number };

export function useFx() {
  return useLive<Fx>(async () => {
    const r = await fetch("/api/fx");
    if (!r.ok) throw new Error("Rates unavailable");
    return r.json();
  }, [], 600_000).data;
}

export function daysUntil(ts: bigint) {
  const ms = Number(ts) * 1000 - Date.now();
  return Math.ceil(ms / 86_400_000);
}
