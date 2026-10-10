import { isAddress, parseAbi, parseEther } from "viem";
import { allow, serverPublic, sponsorWallet } from "@/lib/server";

// Network fees for new accounts come from the GasTap contract, not straight
// from the sponsor wallet: Monad reverts a MON transfer that takes an account
// under its 10 MON reserve while another of its transactions is in flight,
// which made back-to-back top-ups fail. The sponsor only calls the tap.
const GAS_TAP = (process.env.GAS_TAP ?? "0x48fc665129ac0007f2c8d6d9ac9784f8650841cd") as `0x${string}`;
const tapAbi = parseAbi(["function drip(address to, uint256 amount)"]);
const DRIP = parseEther("0.1");
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
  if ((await serverPublic.getBalance({ address: GAS_TAP })) < DRIP) {
    return Response.json({ error: "Network fees are being refilled. Try again in a few minutes." }, { status: 503 });
  }
  const hash = await wallet.writeContract({ address: GAS_TAP, abi: tapAbi, functionName: "drip", args: [address, DRIP] });
  return Response.json({ ok: true, hash });
}
