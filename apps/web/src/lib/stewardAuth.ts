/** The message a session signs to talk to the steward. Shared by client and server. */
export function stewardAuthMessage(address: string, ts: number) {
  return `Vesta steward\n${address.toLowerCase()}\n${ts}`;
}

/** Sign a fresh steward request with the session key. No passkey prompt. */
export async function signStewardAuth(wallet: { signMessage: (a: { message: string }) => Promise<`0x${string}`> }, address: string) {
  const ts = Date.now();
  const sig = await wallet.signMessage({ message: stewardAuthMessage(address, ts) });
  return { ts, sig };
}
