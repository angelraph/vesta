import "server-only";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain } from "./config";

export const serverPublic = createPublicClient({ chain, transport: http(process.env.MONAD_RPC_URL) });

/**
 * The sponsor only pays network fees and hands out the one-time starter
 * balance. It never holds or controls anyone's account.
 */
export function sponsorWallet() {
  const key = process.env.SPONSOR_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) return null;
  return createWalletClient({ account: privateKeyToAccount(key), chain, transport: http(process.env.MONAD_RPC_URL) });
}

const recent = new Map<string, number>();
/** Very small in-memory rate limit. Returns false if this key was used within `ms`. */
export function allow(key: string, ms: number) {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < ms) return false;
  recent.set(key, now);
  return true;
}
