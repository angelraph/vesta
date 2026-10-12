import { http } from "viem";

/**
 * Monad's public RPC answers a burst over 15 requests a second with a JSON-RPC
 * error (-32011) that viem doesn't treat as retryable, so a busy moment like
 * sign-up failed outright. This waits and asks again instead.
 */
async function patientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    const limited = res.status === 429 || (res.ok && /requests limited|rate limit/i.test(await res.clone().text()));
    if (!limited || attempt >= 6) return res;
    await new Promise((ok) => setTimeout(ok, 250 * (attempt + 1) + Math.random() * 250));
  }
}

export const rpc = (url?: string) => http(url, { fetchFn: patientFetch, retryCount: 4, retryDelay: 400 });
