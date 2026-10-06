import { verifyMessage } from "viem";
import { allow } from "@/lib/server";
import { parseAddress, runSteward, StewardOff, type ChatMessage } from "@/lib/steward";
import { stewardAuthMessage } from "@/lib/stewardAuth";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    address?: string;
    houseId?: string | null;
    name?: string;
    memory?: string[];
    messages?: { role: "user" | "assistant"; content: string }[];
    auth?: { ts: number; sig: `0x${string}` };
  } | null;
  const me = parseAddress(body?.address);
  if (!body || !me || !body.auth || !Array.isArray(body.messages)) return Response.json({ error: "Bad request" }, { status: 400 });

  // Signed by the person's session key, so nobody can chat as someone else.
  if (Math.abs(Date.now() - body.auth.ts) > 5 * 60_000) return Response.json({ error: "Please try again." }, { status: 401 });
  const ok = await verifyMessage({ address: me, message: stewardAuthMessage(me, body.auth.ts), signature: body.auth.sig }).catch(() => false);
  if (!ok) return Response.json({ error: "Please unlock Vesta and try again." }, { status: 401 });
  if (!allow(`steward:${me.toLowerCase()}`, 2500)) {
    return Response.json({ error: "One moment, still thinking about the last one." }, { status: 429 });
  }

  const messages: ChatMessage[] = body.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }) as ChatMessage);

  try {
    const out = await runSteward({
      me,
      name: String(body.name ?? "").slice(0, 32),
      houseId: body.houseId && /^\d+$/.test(body.houseId) ? BigInt(body.houseId) : null,
      memory: (body.memory ?? []).filter((m) => typeof m === "string").map((m) => m.slice(0, 140)),
      messages,
    });
    return Response.json(out);
  } catch (e) {
    if (e instanceof StewardOff) return Response.json({ error: "The steward isn't switched on yet." }, { status: 503 });
    console.error("steward", e);
    return Response.json({ error: "The steward is having a moment. Try again shortly." }, { status: 502 });
  }
}
