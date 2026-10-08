import { network } from "hardhat";
import { erc20Abi, keccak256, parseUnits, toHex } from "viem";
import { readFileSync } from "node:fs";

// Sets up a real house on Monad testnet for the CRE rent-day demo:
// `create` makes a $2 house due in two minutes and pays $1 into the pot;
// `topup` pays the missing $1 so the next run pays the landlord.
const d = JSON.parse(readFileSync("deployments/monadTestnet.json", "utf8"));
const FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C";
const step = process.env.STEP ?? "create";

const { viem } = await network.create();
const pub = await viem.getPublicClient();
const [me] = await viem.getWalletClients();
const vault = await viem.getContractAt("HouseVault", d.houseVault);
const wait = async (hash: `0x${string}`) => pub.waitForTransactionReceipt({ hash });

if ((await pub.readContract({ address: d.ausd, abi: erc20Abi, functionName: "balanceOf", args: [me.account.address] })) < parseUnits("2", 6)) {
  await wait(await me.writeContract({ address: FAUCET, abi: [{ type: "function", name: "requestFunds", inputs: [{ type: "address" }], outputs: [], stateMutability: "nonpayable" }], functionName: "requestFunds", args: [me.account.address] }));
}
await wait(await me.writeContract({ address: d.ausd, abi: erc20Abi, functionName: "approve", args: [d.houseVault, parseUnits("2", 6)] }));

if (step === "create") {
  const block = await pub.getBlock();
  const due = block.timestamp + 120n;
  await wait(await vault.write.createHouse(["Rent day demo", me.account.address, parseUnits("2", 6), 30n * 86400n, due, keccak256(toHex("rent-day-demo")), "0x"]));
  const id = await vault.read.houseCount();
  await wait(await vault.write.payRent([id, parseUnits("1", 6)]));
  console.log(`house ${id} due at ${due}, pot $1 of $2`);
} else {
  const id = await vault.read.houseCount();
  await wait(await vault.write.payRent([id, parseUnits("1", 6)]));
  const h = await vault.read.getHouse([id]);
  console.log(`house ${id} pot ${h.pot} of ${h.rent}, due ${h.nextDue}`);
}
