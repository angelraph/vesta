// Every Vesta key comes from one passkey PRF output. HKDF with a distinct
// `info` string gives each job its own namespace, so the account key, each
// house wrapping key and the steward key are unrelated to each other.
// Nothing here is ever written to storage.

const enc = new TextEncoder();
const SALT = enc.encode("vesta.v1");

export const NS = {
  account: "vesta/account/v1",
  /** Keyed by the house invite hash, which is known before the house exists. */
  house: (inviteHash: string) => `vesta/house/${inviteHash.toLowerCase()}/v1`,
  steward: "vesta/steward/v1",
} as const;

export async function importRoot(prfOutput: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", prfOutput as BufferSource, "HKDF", false, ["deriveBits", "deriveKey"]);
}

export async function deriveBytes(root: CryptoKey, info: string, length = 32): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: SALT, info: enc.encode(info) }, root, length * 8);
  return new Uint8Array(bits);
}

export async function deriveAesKey(root: CryptoKey, info: string): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: enc.encode(info) },
    root,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function importAesKey(raw: Uint8Array, usages: KeyUsage[] = ["encrypt", "decrypt"]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, usages);
}

/** AES-GCM. Output is 12-byte IV followed by ciphertext. */
export async function seal(key: CryptoKey, plaintext: Uint8Array, aad?: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad ? enc.encode(aad) : undefined }, key, plaintext as BufferSource),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;
}

export async function open(key: CryptoKey, sealed: Uint8Array, aad?: string): Promise<Uint8Array> {
  const iv = sealed.slice(0, 12);
  const ct = sealed.slice(12);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad ? enc.encode(aad) : undefined }, key, ct as BufferSource),
  );
}

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function toB64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64Url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
