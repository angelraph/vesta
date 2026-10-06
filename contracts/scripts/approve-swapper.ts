import { network } from "hardhat";
import { keccak256, parseAbi, toBytes } from "viem";

// Agora Instant Settlement on Monad testnet: the whitelister lets an address
// approve itself to swap on the CTK/AUSD pair.
const WHITELISTER = "0x7c10F56d6f04a51376393a1C3670e966863F6BD5";
const PAIR = "0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae";

const { viem } = await network.create();
const pub = await viem.getPublicClient();
const [me] = await viem.getWalletClients();
const abi = parseAbi(["function setApprovedSwapper(address)", "function hasRole(bytes32,address) view returns (bool)"]);
const role = keccak256(toBytes("APPROVED_SWAPPER"));

const before = await pub.readContract({ address: PAIR, abi, functionName: "hasRole", args: [role, me.account.address] }).catch(() => "n/a");
console.log("approved before:", before);
await pub.simulateContract({ address: WHITELISTER, abi, functionName: "setApprovedSwapper", args: [me.account.address], account: me.account });
const hash = await me.writeContract({ address: WHITELISTER, abi, functionName: "setApprovedSwapper", args: [me.account.address] });
const r = await pub.waitForTransactionReceipt({ hash });
console.log("tx", hash, r.status, "logs", r.logs.length);
const after = await pub.readContract({ address: PAIR, abi, functionName: "hasRole", args: [role, me.account.address] }).catch(() => "n/a");
console.log("approved after:", after);
