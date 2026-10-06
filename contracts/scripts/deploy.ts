import { network } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";

// Agora AUSD on Monad testnet, and the Chainlink CRE forwarder used by
// `cre workflow simulate --broadcast` on Monad testnet.
const AUSD = (process.env.AUSD_ADDRESS ?? "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC") as `0x${string}`;
const KEEPER = (process.env.KEEPER_ADDRESS ?? "0xB9F79d863261869B234c481D1f9A7af84AeAd192") as `0x${string}`;

const { viem, networkName } = await network.create();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
console.log(`Deploying HouseVault to ${networkName} from ${deployer.account.address}`);

const vault = await viem.deployContract("HouseVault", [AUSD, KEEPER]);
const block = await publicClient.getBlockNumber();
console.log(`HouseVault: ${vault.address} (block ${block})`);

mkdirSync("deployments", { recursive: true });
writeFileSync(
  `deployments/${networkName}.json`,
  JSON.stringify({ chainId: publicClient.chain.id, houseVault: vault.address, ausd: AUSD, keeper: KEEPER, startBlock: Number(block) }, null, 2),
);
