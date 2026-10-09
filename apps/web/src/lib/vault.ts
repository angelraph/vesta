"use client";

import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  parseUnits,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { houseVaultAbi } from "./abi/houseVault";
import { addresses, AUSD_DECIMALS, chain } from "./config";
import { touch, type Unlocked } from "./account";
import { deriveAesKey, fromB64Url, importAesKey, NS, open, randomBytes, seal, toB64Url } from "./keys";

// The public Monad RPC can rate limit or drop a request now and then, so every
// read retries a few times before giving up.
export const publicClient = createPublicClient({ chain, transport: http(undefined, { retryCount: 4, retryDelay: 400 }), pollingInterval: 500 });

export class StillConfirming extends Error {
  constructor() {
    super("It went through, but the network is slow to confirm. Check Activity in a minute before trying again.");
  }
}

/**
 * Waits for a transaction we already sent. A hiccup while waiting doesn't mean
 * it failed, so keep checking for up to a minute before saying anything.
 */
export async function confirmTx(hash: Hex) {
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    try {
      return await publicClient.waitForTransactionReceipt({ hash, timeout: 20_000 });
    } catch {
      const r = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
      if (r) return r;
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  throw new StillConfirming();
}

const vault = { address: addresses.houseVault, abi: houseVaultAbi } as const;

export const toUnits = (usd: string | number) => parseUnits(String(usd), AUSD_DECIMALS);
export const fromUnits = (v: bigint) => Number(formatUnits(v, AUSD_DECIMALS));

export function formatUsd(v: bigint | number, opts: { sign?: boolean } = {}) {
  const n = typeof v === "bigint" ? fromUnits(v) : v;
  const s = Math.abs(n).toLocaleString("en-GB", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  if (opts.sign && n > 0) return `+${s}`;
  return n < 0 ? `-${s}` : s;
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// ------------------------------------------------------------------ reads

export type House = {
  id: bigint;
  name: string;
  creator: Address;
  landlord: Address;
  rent: bigint;
  pot: bigint;
  period: bigint;
  nextDue: bigint;
  cycle: number;
  inviteHash: Hex;
};

export type Member = { address: Address; name: string; rentPaid: bigint; net: bigint };

export async function getBalances(who: Address) {
  const [ausd, mon, received] = await Promise.all([
    publicClient.readContract({ address: addresses.ausd, abi: erc20Abi, functionName: "balanceOf", args: [who] }),
    publicClient.getBalance({ address: who }),
    publicClient.readContract({ address: addresses.settlementPayout, abi: erc20Abi, functionName: "balanceOf", args: [who] }),
  ]);
  // Money sent home lands as the payout token (18 decimals), already converted.
  return { ausd, mon, received: Number(formatUnits(received, 18)) };
}

export async function getMyHouses(who: Address): Promise<bigint[]> {
  return [...(await publicClient.readContract({ ...vault, functionName: "housesOf", args: [who] }))];
}

export async function getHouse(id: bigint): Promise<House> {
  const h = await publicClient.readContract({ ...vault, functionName: "getHouse", args: [id] });
  return { id, ...h, period: BigInt(h.period), nextDue: BigInt(h.nextDue), cycle: Number(h.cycle) };
}

export async function getMembers(id: bigint): Promise<{ members: Member[]; sharePerMember: bigint }> {
  const [addrs, paid, sharePerMember] = await publicClient.readContract({ ...vault, functionName: "rentStatus", args: [id] });
  const extra = await publicClient.multicall({
    contracts: addrs.flatMap((a) => [
      { ...vault, functionName: "displayName", args: [a] } as const,
      { ...vault, functionName: "net", args: [id, a] } as const,
    ]),
    allowFailure: false,
  });
  const members = addrs.map((address, i) => ({
    address,
    name: (extra[i * 2] as string) || short(address),
    rentPaid: paid[i],
    net: extra[i * 2 + 1] as bigint,
  }));
  return { members, sharePerMember };
}

export async function getName(who: Address) {
  return publicClient.readContract({ ...vault, functionName: "displayName", args: [who] });
}

// ----------------------------------------------------------------- writes

async function ensureGas(s: Unlocked) {
  const mon = await publicClient.getBalance({ address: s.address });
  if (mon > parseUnits("0.02", 18)) return;
  const res = await fetch("/api/sponsor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: s.address }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    throw new Error(error || "We couldn't top up network fees right now. Try again in a minute.");
  }
  const { hash } = (await res.json()) as { hash?: Hex };
  if (hash) await confirmTx(hash);
}

async function ensureAllowance(s: Unlocked, amount: bigint) {
  const allowance = await publicClient.readContract({
    address: addresses.ausd,
    abi: erc20Abi,
    functionName: "allowance",
    args: [s.address, addresses.houseVault],
  });
  if (allowance >= amount) return;
  const hash = await s.wallet.writeContract({
    address: addresses.ausd,
    abi: erc20Abi,
    functionName: "approve",
    args: [addresses.houseVault, maxUint256],
  });
  await confirmTx(hash);
}

export const usdText = (v: bigint) => `$${fromUnits(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function send(s: Unlocked, write: () => Promise<Hex>, spend?: bigint) {
  touch();
  if (spend) {
    const have = await publicClient.readContract({ address: addresses.ausd, abi: erc20Abi, functionName: "balanceOf", args: [s.address] });
    if (have < spend) throw new Error(`You have ${usdText(have)} and this needs ${usdText(spend)}. Add money first, or pay a smaller amount.`);
  }
  await ensureGas(s);
  if (spend) await ensureAllowance(s, spend);
  const hash = await write();
  const receipt = await confirmTx(hash);
  if (receipt.status !== "success") throw new Error("The transaction didn't go through.");
  return { hash, receipt };
}

export async function setName(s: Unlocked, name: string) {
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "setName", args: [name] }));
}

/** Creates a house with a fresh house key. Returns the invite link. */
export async function createHouse(
  s: Unlocked,
  p: { name: string; landlord: Address; rentUsd: string; firstDue: Date; periodDays: number },
) {
  const secret = toHex(randomBytes(32));
  const inviteHash = keccak256(secret);
  const houseKey = randomBytes(32);
  const wrapped = await wrapHouseKey(s, inviteHash, houseKey, secret);
  const { hash, receipt } = await send(s, () =>
    s.wallet.writeContract({
      ...vault,
      functionName: "createHouse",
      args: [
        p.name,
        p.landlord,
        toUnits(p.rentUsd),
        BigInt(p.periodDays * 86400),
        BigInt(Math.floor(p.firstDue.getTime() / 1000)),
        inviteHash,
        wrapped,
      ],
    }),
  );
  const created = receipt.logs.find((l) => l.address.toLowerCase() === addresses.houseVault.toLowerCase());
  const houseId = created ? BigInt(created.topics[1]!) : await publicClient.readContract({ ...vault, functionName: "houseCount" });
  return { hash, houseId, invite: inviteLink(houseId, secret, houseKey) };
}

export function inviteLink(houseId: bigint, secret: Hex, houseKey: Uint8Array) {
  // Everything after # stays on the device; it is never sent to a server.
  return `${window.location.origin}/join#${houseId}.${toB64Url(toBytes(secret))}.${toB64Url(houseKey)}`;
}

export function parseInvite(fragment: string) {
  const [id, secret, key] = fragment.replace(/^#/, "").split(".");
  if (!id || !secret || !key) return null;
  return { houseId: BigInt(id), secret: toHex(fromB64Url(secret)), houseKey: fromB64Url(key) };
}

export async function joinHouse(s: Unlocked, invite: { houseId: bigint; secret: Hex; houseKey: Uint8Array }) {
  const house = await getHouse(invite.houseId);
  if (keccak256(invite.secret) !== house.inviteHash) throw new Error("This invite link isn't valid any more.");
  const wrapped = await wrapHouseKey(s, house.inviteHash, invite.houseKey, invite.secret);
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "join", args: [invite.houseId, invite.secret, wrapped] }));
}

export async function payRent(s: Unlocked, houseId: bigint, usd: string) {
  const amount = toUnits(usd);
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "payRent", args: [houseId, amount] }), amount);
}

export async function collectRent(s: Unlocked, houseId: bigint) {
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "collectRent", args: [houseId] }));
}

export async function addExpense(s: Unlocked, houseId: bigint, usd: string, memo: string, participants: Address[]) {
  const amount = toUnits(usd);
  // Split evenly; the first people absorb the leftover cents.
  const base = amount / BigInt(participants.length);
  const rest = amount - base * BigInt(participants.length);
  const shares = participants.map((_, i) => base + (BigInt(i) < rest ? 1n : 0n));
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "addExpense", args: [houseId, amount, memo, participants, shares] }));
}

export async function settle(s: Unlocked, houseId: bigint, to: Address, usd: string) {
  const amount = toUnits(usd);
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "settle", args: [houseId, to, amount] }), amount);
}

const pairAbi = parseAbi(["function getAmountsOut(uint256,address[]) view returns (uint256[])"]);

/** Money sent home settles through Agora's Instant Settlement pair inside the vault call. */
export async function sendHome(s: Unlocked, to: Address, usd: string, corridor: string, fxRate: number, memo: string) {
  const amount = toUnits(usd);
  const corridorBytes = toHex(corridor.slice(0, 3).toUpperCase(), { size: 3 });
  const [, quoted] = await publicClient.readContract({
    address: addresses.settlementPair,
    abi: pairAbi,
    functionName: "getAmountsOut",
    args: [amount, [addresses.ausd, addresses.settlementPayout]],
  });
  const minOut = (quoted * 995n) / 1000n;
  return send(
    s,
    () =>
      s.wallet.writeContract({
        ...vault,
        functionName: "sendHome",
        args: [to, amount, minOut, corridorBytes, BigInt(Math.round(fxRate * 1e6)), memo],
      }),
    amount,
  );
}

// ------------------------------------------------------ encrypted house data

async function wrapKeyFor(s: Unlocked, inviteHash: Hex) {
  return deriveAesKey(s.root, NS.house(inviteHash));
}

/** The house key and the invite secret travel together, sealed to this member. */
async function wrapHouseKey(s: Unlocked, inviteHash: Hex, houseKey: Uint8Array, secret: Hex): Promise<Hex> {
  const k = await wrapKeyFor(s, inviteHash);
  const payload = new Uint8Array(64);
  payload.set(houseKey, 0);
  payload.set(toBytes(secret), 32);
  const sealed = await seal(k, payload, s.address.toLowerCase());
  payload.fill(0);
  return toHex(sealed);
}

async function unwrap(s: Unlocked, house: House): Promise<Uint8Array | null> {
  const wrapped = await publicClient.readContract({ ...vault, functionName: "keyring", args: [house.id, s.address] });
  if (!wrapped || wrapped === "0x") return null;
  const k = await wrapKeyFor(s, house.inviteHash);
  return open(k, toBytes(wrapped), s.address.toLowerCase());
}

export async function loadHouseKey(s: Unlocked, house: House): Promise<CryptoKey | null> {
  const raw = await unwrap(s, house);
  if (!raw) return null;
  const key = await importAesKey(raw.slice(0, 32));
  raw.fill(0);
  return key;
}

/** Any member can recreate the invite link from what they hold. */
export async function recreateInvite(s: Unlocked, house: House): Promise<string | null> {
  const raw = await unwrap(s, house);
  if (!raw) return null;
  const link = inviteLink(house.id, toHex(raw.slice(32)), raw.slice(0, 32));
  raw.fill(0);
  return link;
}

export type HouseNote = { label: string; value: string };
export type HouseNotes = { items: HouseNote[]; updatedBy?: string; at?: number };

export async function readNotes(houseId: bigint, key: CryptoKey): Promise<HouseNotes> {
  const blob = await publicClient.readContract({ ...vault, functionName: "houseNotes", args: [houseId] });
  if (!blob || blob === "0x") return { items: [] };
  const plain = await open(key, toBytes(blob), `house:${houseId}`);
  return JSON.parse(new TextDecoder().decode(plain)) as HouseNotes;
}

export async function writeNotes(s: Unlocked, houseId: bigint, key: CryptoKey, notes: HouseNotes) {
  const plain = new TextEncoder().encode(JSON.stringify({ ...notes, updatedBy: s.address, at: Date.now() }));
  const blob = toHex(await seal(key, plain, `house:${houseId}`));
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "setHouseNotes", args: [houseId, blob] }));
}

// ------------------------------------------------------------ steward memory

export type Contact = { name: string; address: `0x${string}`; corridor: string };
export type StewardMemory = { facts: string[]; contacts?: Contact[]; at?: number };

export async function readMemory(s: Unlocked): Promise<StewardMemory> {
  const blob = await publicClient.readContract({ ...vault, functionName: "stewardMemory", args: [s.address] });
  if (!blob || blob === "0x") return { facts: [] };
  const plain = await open(s.stewardKey, toBytes(blob), `steward:${s.address.toLowerCase()}`);
  return JSON.parse(new TextDecoder().decode(plain)) as StewardMemory;
}

export async function writeMemory(s: Unlocked, memory: StewardMemory) {
  const plain = new TextEncoder().encode(JSON.stringify({ ...memory, at: Date.now() }));
  const blob = toHex(await seal(s.stewardKey, plain, `steward:${s.address.toLowerCase()}`));
  return send(s, () => s.wallet.writeContract({ ...vault, functionName: "setStewardMemory", args: [blob] }));
}
