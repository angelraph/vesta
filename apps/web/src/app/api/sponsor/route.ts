import { isAddress, parseEther } from "viem";
import { allow, serverPublic, sponsorWallet } from "@/lib/server";

const DRIP = parseEther("0.15");
const FLOOR = parseEther("0.05");

export async function POST(req: Request) {
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !isAddress(address)) return Response.json({ error: "Bad address" }, { status: 400 });
  const wallet = sponsorWallet();
  if (!wallet) return Response.json({ error: "Network fees aren't set up on this server yet." }, { status: 503 });

  const balance = await serverPublic.getBalance({ address });
  if (balance >= FLOOR) return Response.json({ ok: true });
  if (!allow(`gas:${address.toLowerCase()}`, 20_000)) {
    return Response.json({ error: "Fees were just topped up. Give it a minute." }, { status: 429 });
  }
  const hash = await wallet.sendTransaction({ to: address, value: DRIP });
  return Response.json({ ok: true, hash });
}
