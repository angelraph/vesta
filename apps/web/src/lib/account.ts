"use client";

import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
  isMeraError,
  type PasskeyCredentialMetadata,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { createWalletClient, http, type Address, type WalletClient, type Account, type Chain, type Transport } from "viem";
import { chain, SESSION_IDLE_MS } from "./config";
import { deriveAesKey, deriveBytes, importRoot, NS } from "./keys";

// Only non-secret hints live in localStorage. Losing them changes nothing:
// signing in without them asks the platform for any Vesta passkey, and the
// same passkey always rebuilds the same account.
const HINT_KEY = "vesta.hint";
type Hint = { credentialId: string; address: Address };

export type Unlocked = {
  address: Address;
  wallet: WalletClient<Transport, Chain, Account>;
  /** Root key material, non-extractable. Used to derive house and steward keys. */
  root: CryptoKey;
  stewardKey: CryptoKey;
  credential: PasskeyCredentialMetadata;
  expiresAt: number;
};

export type AccountState =
  | { status: "loading" }
  | { status: "signedOut"; hint: Hint | null }
  | { status: "locked"; hint: Hint }
  | { status: "unlocked"; session: Unlocked };

const SERVER_STATE: AccountState = { status: "loading" };
let state: AccountState = SERVER_STATE;
let signing: Secp256k1SigningSession | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

export const accountStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
  getServer: (): AccountState => SERVER_STATE,
};

function readHint(): Hint | null {
  try {
    const raw = localStorage.getItem(HINT_KEY);
    return raw ? (JSON.parse(raw) as Hint) : null;
  } catch {
    return null;
  }
}

function writeHint(h: Hint) {
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify(h));
  } catch {
    // private mode: fine, the passkey is enough
  }
}

export function initAccount() {
  if (state.status !== "loading") return;
  const hint = readHint();
  set(hint ? { status: "locked", hint } : { status: "signedOut", hint: null });
}

const rpId = () => window.location.hostname;

async function openSession(prfOutput: Uint8Array, credential: PasskeyCredentialMetadata): Promise<Unlocked> {
  const root = await importRoot(prfOutput);
  prfOutput.fill(0);
  const privateKey = await deriveBytes(root, NS.account);
  signing?.end();
  signing = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0);
  const address = getEvmAddress(signing.publicKey) as Address;
  const wallet = createWalletClient({ account: toViemAccount(signing), chain, transport: http() });
  const stewardKey = await deriveAesKey(root, NS.steward);
  const session: Unlocked = { address, wallet, root, stewardKey, credential, expiresAt: Date.now() + SESSION_IDLE_MS };
  writeHint({ credentialId: credential.credentialId, address });
  set({ status: "unlocked", session });
  touch();
  return session;
}

/** One passkey ceremony creates the account. No email, no seed phrase. */
export async function createAccount(name: string): Promise<Unlocked> {
  const res = await createPasskeyWithPrfOutput({
    rp: { id: rpId(), name: "Vesta" },
    user: { name, displayName: name },
  });
  return openSession(res.prfOutput, { credentialId: res.credentialId, transports: res.transports });
}

/** Sign in with whichever Vesta passkey the device offers. */
export async function unlock(): Promise<Unlocked> {
  const res = await getPasskeyPrfOutput({ rpId: rpId() });
  return openSession(res.prfOutput, { credentialId: res.credentialId });
}

/**
 * Ask for the passkey again before a bigger action, and check it is the same
 * person. Refreshes the session on success.
 */
export async function confirmWithPasskey(): Promise<Unlocked> {
  if (state.status !== "unlocked") throw new Error("Locked");
  const current = state.session;
  const res = await getPasskeyPrfOutput({ rpId: rpId(), credential: current.credential });
  const root = await importRoot(res.prfOutput);
  res.prfOutput.fill(0);
  const pk = await deriveBytes(root, NS.account);
  const check = createSecp256k1SigningSession({ privateKey: pk });
  pk.fill(0);
  const same = getEvmAddress(check.publicKey) === current.address;
  check.end();
  if (!same) throw new Error("That passkey belongs to a different account.");
  touch();
  return current;
}

/** Keep the session alive while it is being used. */
export function touch() {
  if (state.status !== "unlocked") return;
  state.session.expiresAt = Date.now() + SESSION_IDLE_MS;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(lock, SESSION_IDLE_MS);
}

export function lock() {
  signing?.end();
  signing = null;
  if (idleTimer) clearTimeout(idleTimer);
  const hint = readHint();
  set(hint ? { status: "locked", hint } : { status: "signedOut", hint: null });
}

export function signOut() {
  lock();
  try {
    localStorage.removeItem(HINT_KEY);
  } catch {}
  set({ status: "signedOut", hint: null });
}

export function friendlyError(e: unknown): string {
  if (isMeraError(e)) {
    switch (e.code) {
      case "PRF_UNAVAILABLE":
        return "This device's passkeys can't be used here yet. Try Chrome, Safari on iOS 18+, or a recent Android phone.";
      case "PASSKEY_OPERATION_FAILED":
        return "The passkey prompt was closed. Try again when you're ready.";
      case "SESSION_ENDED":
        return "Your session ended. Unlock again to continue.";
      default:
        return "Something went wrong with your passkey. Please try again.";
    }
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.length > 160 || /HTTP request failed|rate limit|429|timed? ?out/i.test(msg)) console.error("vesta", e);
  if (/insufficient funds/i.test(msg)) return "Not enough to cover that yet.";
  if (/HTTP request failed|rate limit|429|fetch failed|Failed to fetch/i.test(msg)) return "The network is busy right now. Wait a moment and try again.";
  if (/timed? ?out|TimeoutError/i.test(msg)) return "The network is slow right now. Check Activity before trying again.";
  if (/User rejected|NotAllowedError/i.test(msg)) return "Cancelled.";
  return msg.length > 160 ? "Something went wrong. Please try again." : msg;
}
