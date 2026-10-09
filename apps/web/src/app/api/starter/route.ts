import { erc20Abi, isAddress, parseAbi, parseUnits } from "viem";
import { addresses } from "@/lib/config";
import { allow, serverPublic, sponsorWallet } from "@/lib/server";

// Test money from the Vesta pool, so people can try everything without buying
// anything. Testnet only. The pool tops itself up from Agora's AUSD faucet.
const GRANT = parseUnits(process.env.STARTER_AUSD ?? "100", 6);
const CAP = parseUnits("500", 6); // only while the person holds less than this
const REFILL_BELOW = parseUnits("1000", 6);
const AGORA_FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C";
const faucetAbi = parseAbi(["function requestFunds(address)"]);

const balanceOf = (who: `0x${string}`) =>
  serverPublic.readContract({ address: addresses.ausd, abi: erc20Abi, functionName: "balanceOf", args: [who] });

export async function POST(req: Request) {
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !isAddress(address)) return Response.json({ error: "Bad address" }, { status: 400 });
  const wallet = sponsorWallet();
  if (!wallet) return Response.json({ error: "Test money isn't set up yet." }, { status: 503 });

  if ((await balanceOf(address)) >= CAP) {
    return Response.json({ error: "You already have plenty of test money. Spend some first." }, { status: 409 });
  }
  if (!allow(`starter:${address.toLowerCase()}`, 2 * 60_000)) {
    return Response.json({ error: "Test money was just sent. Try again in a couple of minutes." }, { status: 429 });
  }

  let pool = await balanceOf(wallet.account.address);
  if (pool < REFILL_BELOW) {
    // Agora's faucet drips to anyone once a minute; refill before running dry.
    const drip = await wallet.writeContract({ address: AGORA_FAUCET, abi: faucetAbi, functionName: "requestFunds", args: [wallet.account.address] }).catch(() => null);
    if (drip) {
      await serverPublic.waitForTransactionReceipt({ hash: drip }).catch(() => null);
      pool = await balanceOf(wallet.account.address);
    }
  }
  if (pool < GRANT) return Response.json({ error: "The test money pool is refilling. Try again in a minute." }, { status: 503 });

  const hash = await wallet.writeContract({ address: addresses.ausd, abi: erc20Abi, functionName: "transfer", args: [address, GRANT] });
  return Response.json({ ok: true, hash });
}
