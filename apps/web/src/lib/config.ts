import { monadTestnet } from "viem/chains";

export const chain = monadTestnet;

export const addresses = {
  houseVault: (process.env.NEXT_PUBLIC_HOUSE_VAULT ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  ausd: (process.env.NEXT_PUBLIC_AUSD ?? "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC") as `0x${string}`,
  // Agora Instant Settlement on Monad testnet
  settlementPair: "0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae" as `0x${string}`,
  settlementWhitelister: "0x7c10F56d6f04a51376393a1C3670e966863F6BD5" as `0x${string}`,
} as const;

export const AUSD_DECIMALS = 6;

export const explorerTx = (hash: string) => `${chain.blockExplorers.default.url}/tx/${hash}`;

/** Actions at or under this many dollars sign without a new passkey prompt. */
export const SESSION_LIMIT_USD = 100;
/** A signing session ends after this long without use. */
export const SESSION_IDLE_MS = 15 * 60 * 1000;
