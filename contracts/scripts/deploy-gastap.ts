import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";

// Deploys GasTap, funds it, and proves that back-to-back drips succeed
// (the case that reverted when the sponsor sent MON directly).
const FUND = process.env.GASTAP_FUND ?? "4";

const { viem } = await network.create();
const pub = await viem.getPublicClient();
const [me] = await viem.getWalletClients();
const tap = await viem.deployContract("GasTap", []);
console.log("GasTap", tap.address);
await pub.waitForTransactionReceipt({ hash: await me.sendTransaction({ to: tap.address, value: parseEther(FUND) }) });
console.log("funded", formatEther(await pub.getBalance({ address: tap.address })), "MON");

const a = privateKeyToAccount(generatePrivateKey()).address;
const b = privateKeyToAccount(generatePrivateKey()).address;
const h1 = await tap.write.drip([a, parseEther("0.001")]);
const h2 = await tap.write.drip([b, parseEther("0.001")]);
for (const h of [h1, h2]) console.log("drip", (await pub.waitForTransactionReceipt({ hash: h })).status);

const d = JSON.parse(readFileSync("deployments/monadTestnet.json", "utf8"));
d.gasTap = tap.address;
writeFileSync("deployments/monadTestnet.json", JSON.stringify(d, null, 2));
