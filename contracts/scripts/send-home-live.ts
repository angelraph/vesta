import { network } from "hardhat";
import { erc20Abi, parseAbi, parseUnits, toHex } from "viem";
import { readFileSync } from "node:fs";

// Live check of Agora Instant Settlement through HouseVault.sendHome on Monad
// testnet: draws AUSD from Agora's faucet, sends $1 and prints what landed.
const d = JSON.parse(readFileSync("deployments/monadTestnet.json", "utf8"));
const FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C";
const pairAbi = parseAbi([
  "function hasRole(string,address) view returns (bool)",
  "function getAmountsOut(uint256,address[]) view returns (uint256[])",
]);

const { viem } = await network.create();
const pub = await viem.getPublicClient();
const [me] = await viem.getWalletClients();
const vault = await viem.getContractAt("HouseVault", d.houseVault);
const to = (process.env.RECIPIENT ?? me.account.address) as `0x${string}`;

console.log("vault approved swapper:", await pub.readContract({ address: d.settlement, abi: pairAbi, functionName: "hasRole", args: ["APPROVED_SWAPPER", d.houseVault] }));

const amount = parseUnits("1", 6);
if ((await pub.readContract({ address: d.ausd, abi: erc20Abi, functionName: "balanceOf", args: [me.account.address] })) < amount) {
  const h = await me.writeContract({ address: FAUCET, abi: parseAbi(["function requestFunds(address)"]), functionName: "requestFunds", args: [me.account.address] });
  await pub.waitForTransactionReceipt({ hash: h });
}
await pub.waitForTransactionReceipt({ hash: await me.writeContract({ address: d.ausd, abi: erc20Abi, functionName: "approve", args: [d.houseVault, amount] }) });

const [, quoted] = await pub.readContract({ address: d.settlement, abi: pairAbi, functionName: "getAmountsOut", args: [amount, [d.ausd, d.payout]] });
const before = await pub.readContract({ address: d.payout, abi: erc20Abi, functionName: "balanceOf", args: [to] });
const hash = await vault.write.sendHome([to, amount, (quoted * 995n) / 1000n, toHex("NGN"), 1_550_000_000n, "Live check"]);
const r = await pub.waitForTransactionReceipt({ hash });
const after = await pub.readContract({ address: d.payout, abi: erc20Abi, functionName: "balanceOf", args: [to] });
console.log("tx", hash, r.status);
console.log("recipient received", after - before, "payout units");
