"use client";

import type { Address } from "viem";
import { useLive } from "./hooks";

// History comes from our Envio HyperIndex indexer. Monad's public RPC only
// serves 100 blocks of logs per call, so a real feed needs an indexer.
const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL;

export type ActivityKind = "rent" | "collect" | "expense" | "settle" | "sent" | "joined" | "created" | "shortfall";

export type Activity = {
  id: string;
  kind: ActivityKind;
  houseId: string | null;
  actor: Address;
  counterparty: Address | null;
  amount: string; // AUSD base units
  memo: string | null;
  corridor: string | null;
  fxRate: string | null;
  timestamp: number;
  txHash: string;
};

const QUERY = `query Feed($me: String!, $houses: [String!]!, $limit: Int!) {
  Activity(
    where: { _or: [{ actor: { _eq: $me } }, { counterparty: { _eq: $me } }, { houseId: { _in: $houses } }] }
    order_by: { timestamp: desc }
    limit: $limit
  ) { id kind houseId actor counterparty amount memo corridor fxRate timestamp txHash }
}`;

export async function fetchActivity(me: Address, houses: bigint[], limit = 20): Promise<Activity[] | null> {
  if (!INDEXER) return null;
  const res = await fetch(INDEXER, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { me: me.toLowerCase(), houses: houses.map(String), limit } }),
  });
  if (!res.ok) throw new Error("History is unavailable right now.");
  const json = (await res.json()) as { data?: { Activity: Activity[] }; errors?: unknown };
  return (json.data?.Activity ?? []).map((a) => ({ ...a, timestamp: Number(a.timestamp) }));
}

export function useActivity(me: Address | undefined, houses: bigint[], limit = 20) {
  return useLive(me ? () => fetchActivity(me, houses, limit) : null, [me, houses.join(","), limit], 8_000);
}

export function dayLabel(ts: number) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
