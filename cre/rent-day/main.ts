import {
  bytesToHex,
  consensusMedianAggregation,
  CronCapability,
  encodeCallMsg,
  EVMClient,
  getNetwork,
  handler,
  hexToBase64,
  HTTPClient,
  LAST_FINALIZED_BLOCK_NUMBER,
  Runner,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk";
import { decodeFunctionResult, encodeAbiParameters, encodeFunctionData, parseAbi, parseAbiParameters, zeroAddress, type Address, type Hex } from "viem";

// Rent day for every Vesta house. Once a day the workflow reads each house from
// HouseVault on Monad, checks the live exchange rate, and sends a signed report
// back to the vault: pay the landlord when rent is due and the pot is full, or
// flag each housemate who is short in the days before (and on) rent day.

export type Config = {
  schedule: string;
  chainName: string;
  houseVault: Address;
  fxUrl: string;
  currency: string; // what housemates think in, e.g. GBP
  warnDays: number; // start flagging shortfalls this many days before rent day
  maxReports: number; // safety cap on onchain writes per run
  gasLimit: string;
};

const vaultAbi = parseAbi([
  "function houseCount() view returns (uint256)",
  "function getHouse(uint256) view returns ((string name, address creator, address landlord, uint256 rent, uint256 pot, uint64 period, uint64 nextDue, uint32 cycle, bytes32 inviteHash))",
  "function rentStatus(uint256) view returns (address[] members, uint256[] paid, uint256 sharePerMember)",
]);

const COLLECT = 1;
const SHORTFALL = 2;
const DAY = 86_400;

type Action = { kind: typeof COLLECT | typeof SHORTFALL; houseId: bigint; member: Address; amount: bigint; note: string };

/** USD to local currency, 1e6 scaled. Each node fetches it and the network takes the median. */
const fetchRate = (node: NodeRuntime<Config>): bigint => {
  const res = new HTTPClient().sendRequest(node, { url: node.config.fxUrl, method: "GET" }).result();
  const body = JSON.parse(new TextDecoder().decode(res.body)) as { rates?: Record<string, number> };
  const rate = body.rates?.[node.config.currency];
  if (!rate) throw new Error(`No ${node.config.currency} rate in FX response`);
  return BigInt(Math.round(rate * 1e6));
};

const money = (ausd: bigint, rate: bigint, currency: string) => {
  const usd = Number(ausd) / 1e6;
  const local = (usd * Number(rate)) / 1e6;
  return `$${usd.toFixed(2)} (${currency} ${local.toFixed(2)})`;
};

export const onRentDay = (runtime: Runtime<Config>): string => {
  const cfg = runtime.config;
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: cfg.chainName });
  if (!network) throw new Error(`Unknown chain ${cfg.chainName}`);
  const evm = new EVMClient(network.chainSelector.selector);

  const read = <F extends "houseCount" | "getHouse" | "rentStatus">(functionName: F, args: readonly unknown[]) => {
    const data = encodeFunctionData({ abi: vaultAbi, functionName, args } as never);
    const reply = evm
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: cfg.houseVault, data }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();
    return decodeFunctionResult({ abi: vaultAbi, functionName, data: bytesToHex(reply.data) as Hex } as never);
  };

  const rate = runtime.runInNodeMode(fetchRate, consensusMedianAggregation<bigint>())().result();
  runtime.log(`Rate: $1 = ${cfg.currency} ${(Number(rate) / 1e6).toFixed(4)}`);

  const now = BigInt(Math.floor(runtime.now().getTime() / 1000));
  const count = read("houseCount", []) as bigint;
  runtime.log(`Checking ${count} house(s)`);

  const actions: Action[] = [];
  for (let id = 1n; id <= count; id++) {
    const h = read("getHouse", [id]) as { name: string; rent: bigint; pot: bigint; nextDue: bigint };
    const due = h.nextDue;
    if (now >= due && h.pot >= h.rent) {
      actions.push({ kind: COLLECT, houseId: id, member: zeroAddress, amount: h.rent, note: `${h.name}: rent due, pot full, paying ${money(h.rent, rate, cfg.currency)}` });
      continue;
    }
    if (now + BigInt(cfg.warnDays * DAY) < due) continue;
    const [members, paid, share] = read("rentStatus", [id]) as [Address[], bigint[], bigint];
    members.forEach((m, i) => {
      if (paid[i] < share) {
        const short = share - paid[i];
        actions.push({ kind: SHORTFALL, houseId: id, member: m, amount: short, note: `${h.name}: ${m.slice(0, 8)} is short ${money(short, rate, cfg.currency)}` });
      }
    });
  }

  if (actions.length === 0) {
    runtime.log("Nothing due. Every house is on track.");
    return "nothing due";
  }

  const sent: string[] = [];
  for (const a of actions.slice(0, cfg.maxReports)) {
    runtime.log(a.note);
    const payload = encodeAbiParameters(parseAbiParameters("uint8, uint256, address, uint256"), [a.kind, a.houseId, a.member, a.amount]);
    const report = runtime.report({ encodedPayload: hexToBase64(payload), encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256" }).result();
    const reply = evm.writeReport(runtime, { receiver: cfg.houseVault, report, gasConfig: { gasLimit: cfg.gasLimit } }).result();
    const hash = bytesToHex(reply.txHash ?? new Uint8Array(32));
    if (reply.txStatus !== 2) throw new Error(`Report for house ${a.houseId} failed: ${reply.errorMessage ?? reply.txStatus}`);
    runtime.log(`Written onchain: ${hash}`);
    sent.push(hash);
  }
  return `${sent.length} report(s): ${sent.join(", ")}`;
};

export const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onRentDay)];

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
