"use client";

import type { WebAuthnClient } from "@category-labs/mera";

// Mera's WebAuthn calls, with one change for sign-up: when the authenticator
// doesn't hand back the PRF output at creation, the follow-up assertion waits
// for a real tap. iOS and some Android browsers refuse (or silently ignore) a
// passkey request that no tap started, which left people stuck after the first
// fingerprint.

const bytes = (v: ArrayBuffer | ArrayBufferView) =>
  v instanceof ArrayBuffer ? new Uint8Array(v.slice(0)) : new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));

type Prf = { enabled?: boolean; results?: { first?: ArrayBuffer | ArrayBufferView } };

/**
 * Some phones never answer a passkey request: no prompt shows, or it closes
 * without telling the page. Give up after a minute with a message that says
 * what to try, instead of spinning forever.
 */
const PASSKEY_WAIT_MS = 60_000;
const PASSKEY_STUCK =
  "Your phone didn't finish the passkey. Make sure it has a screen lock, open this link in Chrome (not inside WhatsApp), and try again.";

function watchdog() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PASSKEY_WAIT_MS);
  return {
    signal: ctl.signal,
    done: () => clearTimeout(timer),
    fail: (e: unknown): never => {
      throw ctl.signal.aborted ? new Error(PASSKEY_STUCK) : e;
    },
  };
}

async function create(req: WebAuthnClient.CreateCredentialRequest): Promise<WebAuthnClient.CreateCredentialResult> {
  const w = watchdog();
  const cred = (await navigator.credentials
    .create({
      signal: w.signal,
      publicKey: {
        rp: req.rp,
        user: req.user,
        challenge: req.challenge,
        pubKeyCredParams: req.algorithms.map((alg) => ({ type: "public-key" as const, alg })),
        timeout: req.timeout ?? 120_000,
        attestation: req.attestation,
        authenticatorSelection: { residentKey: req.residentKey, requireResidentKey: true, userVerification: req.userVerification },
        extensions: { prf: { eval: { first: req.prfSalt } } } as AuthenticationExtensionsClientInputs,
      },
    })
    .catch(w.fail)
    .finally(w.done)) as PublicKeyCredential | null;
  if (!cred) throw new DOMException("No passkey was created", "NotAllowedError");
  const prf = (cred.getClientExtensionResults() as { prf?: Prf }).prf;
  const response = cred.response as AuthenticatorAttestationResponse;
  const transports = typeof response.getTransports === "function" ? (response.getTransports() as WebAuthnClient.CreateCredentialResult["transports"]) : undefined;
  const first = prf?.results?.first;
  return {
    credentialId: new Uint8Array(cred.rawId),
    ...(transports ? { transports } : {}),
    prfEnabled: prf?.enabled === true || !!first,
    ...(first ? { prfOutput: bytes(first) } : {}),
  };
}

function get(req: WebAuthnClient.GetCredentialRequest): Promise<WebAuthnClient.GetCredentialResult> {
  const allow = req.allowCredential;
  const w = watchdog();
  return navigator.credentials
    .get({
      signal: w.signal,
      publicKey: {
        rpId: req.rpId,
        challenge: req.challenge,
        timeout: req.timeout ?? 120_000,
        userVerification: req.userVerification,
        extensions: { prf: { eval: { first: req.prfSalt } } } as AuthenticationExtensionsClientInputs,
        ...(allow
          ? { allowCredentials: [{ id: allow.credentialId, type: "public-key" as const, ...(allow.transports ? { transports: allow.transports as AuthenticatorTransport[] } : {}) }] }
          : {}),
      },
    })
    .catch(w.fail)
    .finally(w.done)
    .then((c) => {
      const cred = c as PublicKeyCredential | null;
      if (!cred) throw new DOMException("No passkey was chosen", "NotAllowedError");
      const first = (cred.getClientExtensionResults() as { prf?: Prf }).prf?.results?.first;
      return { credentialId: new Uint8Array(cred.rawId), ...(first ? { prfOutput: bytes(first) } : {}) };
    });
}

// ------------------------------------------------------------ the extra tap

type Pending = { req: WebAuthnClient.GetCredentialRequest; settle: (p: Promise<WebAuthnClient.GetCredentialResult>) => void };
let pending: Pending | null = null;
let error: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const finishStep = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  waiting: () => pending !== null,
  error: () => error,
  /** Call straight from a click handler, so the browser sees a real tap. */
  finish() {
    if (!pending) return;
    const p = pending;
    error = null;
    p.settle(get(p.req));
    emit();
  },
};

/** Sign-up client: creation runs from the button tap; the follow-up waits for another tap. */
export const signUpClient: WebAuthnClient = {
  createCredential: create,
  async getCredential(req) {
    for (let attempt = 0; ; attempt++) {
      const result = await new Promise<Promise<WebAuthnClient.GetCredentialResult>>((settle) => {
        pending = { req, settle };
        emit();
      });
      try {
        const out = await result;
        pending = null;
        error = null;
        emit();
        return out;
      } catch (e) {
        if (attempt >= 4) {
          pending = null;
          emit();
          throw e;
        }
        error = "That didn't go through. Tap the button to try again.";
        emit();
      }
    }
  },
};

/** Plain client for unlock and confirmations, which always start from a tap. */
export const tapClient: WebAuthnClient = { createCredential: create, getCredential: get };

// ------------------------------------------------------------ browser checks

export type BrowserIssue = null | "no-passkeys" | "in-app" | "no-prf" | "old-ios";

export async function checkBrowser(): Promise<BrowserIssue> {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|Telegram|LinkedInApp|TikTok|musical_ly|BytedanceWebview|WhatsApp|; wv\)/i.test(ua)) return "in-app";
  if (!window.PublicKeyCredential) return "no-passkeys";
  const ios = ua.match(/iPhone OS (\d+)_|iPad; CPU OS (\d+)_/);
  if (ios && Number(ios[1] ?? ios[2]) < 18) return "old-ios";
  const caps = (PublicKeyCredential as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> }).getClientCapabilities;
  if (caps) {
    const c = await caps().catch(() => null);
    if (c && c["extension:prf"] === false) return "no-prf";
  }
  return null;
}
