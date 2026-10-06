import { erc20Abi, isAddress, parseUnits } from "viem";
import { addresses } from "@/lib/config";
import { allow, serverPublic, sponsorWallet } from "@/lib/server";

// Real AUSD from the Vesta treasury, once per new account, so people can try
// the app without buying anything first.
const GRANT = parseUnits(process.env.STARTER_AUSD ?? "25", 6);

export async function POST(req: Request) {
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !isAddress(address)) return Response.json({ error: "Bad address" }, { status: 400 });
  const wallet = sponsorWallet();
  if (!wallet) return Response.json({ error: "Starter balances aren't set up yet." }, { status: 503 });

  const balance = await serverPublic.readContract({ address: addresses.ausd, abi: erc20Abi, functionName: "balanceOf", args: [address] });
  if (balance > 0n) return Response.json({ error: "This account already has a balance." }, { status: 409 });
  if (!allow(`starter:${address.toLowerCase()}`, 24 * 3600_000)) {
    return Response.json({ error: "Starter balance already sent." }, { status: 429 });
  }
  const treasury = await serverPublic.readContract({
    address: addresses.ausd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet.account.address],
  });
  if (treasury < GRANT) return Response.json({ error: "The starter pool is empty right now." }, { status: 503 });
  const hash = await wallet.writeContract({ address: addresses.ausd, abi: erc20Abi, functionName: "transfer", args: [address, GRANT] });
  return Response.json({ ok: true, hash });
}
