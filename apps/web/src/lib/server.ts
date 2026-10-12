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

/**
 * Sends from the sponsor, retrying while an earlier send is still landing.
 * Sign-up fires the starter money and the fee top-up back to back, and the
 * second one can pick up the same nonce before the first is counted.
 */
export async function sponsorSend(send: () => Promise<`0x${string}`>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).toLowerCase();
      const busy = /nonce|already known|replacement|underpriced|reserve|429|rate limit|timeout|fetch failed/.test(msg);
      if (!busy || attempt >= 5) throw e;
      await new Promise((ok) => setTimeout(ok, 700 * (attempt + 1)));
    }
  }
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
