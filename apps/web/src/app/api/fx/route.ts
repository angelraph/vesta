// Live mid-market rates, USD base. Cached for ten minutes.
type Rates = { at: number; rates: Record<string, number> };
let cache: Rates | null = null;

export async function GET() {
  if (!cache || Date.now() - cache.at > 600_000) {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    if (!res.ok) return Response.json({ error: "Rates unavailable" }, { status: 502 });
    const data = (await res.json()) as { rates: Record<string, number> };
    const pick = ["GBP", "NGN", "GHS", "KES", "EUR", "ZAR"];
    cache = { at: Date.now(), rates: Object.fromEntries(pick.map((c) => [c, data.rates[c]])) };
  }
  return Response.json(cache);
}
