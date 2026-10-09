// Reads transactions straight from Monad testnet and prints what happened in
// each, for the onchain proof cards in the videos. Usage:
//   node --experimental-strip-types proof.mts <hash> [<hash> ...]
import { createPublicClient, decodeEventLog, erc20Abi, formatUnits, http, type Hex } from "viem";
import { monadTestnet } from "viem/chains";
import { houseVaultAbi } from "../apps/web/src/lib/abi/houseVault.ts";

const c = createPublicClient({ chain: monadTestnet, transport: http() });
const names: Record<string, string> = {
  "0x1cb8182e22e7716f9dc9174f1be7591157288559": "HouseVault",
  "0xa9012a055bd4e0edff8ce09f960291c09d5322dc": "AUSD",
  "0x7beb5d9db0d85cbea543c04f0de8c23c2176cd9d": "CTK (local payout)",
  "0x1aa8958aa34cec8096ef4381cb335effe977b0ae": "Agora Instant Settlement",
  "0xb9f79d863261869b234c481d1f9a7af84aead192": "Chainlink CRE forwarder",
};
const label = (a: string) => names[a.toLowerCase()] ?? `${a.slice(0, 6)}…${a.slice(-4)}`;

const out = [];
for (const hash of process.argv.slice(2) as Hex[]) {
  const [r, tx] = await Promise.all([c.getTransactionReceipt({ hash }), c.getTransaction({ hash })]);
  const block = await c.getBlock({ blockNumber: r.blockNumber });
  const events = [];
  for (const l of r.logs) {
    try {
      const e = decodeEventLog({ abi: houseVaultAbi, data: l.data, topics: l.topics });
      const args = Object.fromEntries(Object.entries(e.args as Record<string, unknown>).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));
      events.push({ contract: label(l.address), name: e.eventName, args });
      continue;
    } catch {}
    try {
      const e = decodeEventLog({ abi: erc20Abi, data: l.data, topics: l.topics });
      if (e.eventName === "Transfer") {
        const dec = l.address.toLowerCase().startsWith("0xa9012a") ? 6 : 18;
        events.push({ contract: label(l.address), name: "Transfer", args: { from: label(e.args.from), to: label(e.args.to), amount: formatUnits(e.args.value, dec) } });
        continue;
      }
    } catch {}
    if (l.address.toLowerCase() === "0x1aa8958aa34cec8096ef4381cb335effe977b0ae") events.push({ contract: label(l.address), name: "Swap", args: {} });
  }
  out.push({
    hash,
    status: r.status,
    block: r.blockNumber.toString(),
    time: new Date(Number(block.timestamp) * 1000).toISOString(),
    from: label(tx.from),
    to: label(tx.to ?? ""),
    events,
  });
}
console.log(JSON.stringify(out, null, 1));
