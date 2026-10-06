import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const { abi } = JSON.parse(readFileSync("artifacts/contracts/HouseVault.sol/HouseVault.json", "utf8"));
mkdirSync("../apps/web/src/lib/abi", { recursive: true });
writeFileSync("../apps/web/src/lib/abi/houseVault.ts", `// Generated from contracts/ by scripts/export-abi.mjs. Do not edit.\nexport const houseVaultAbi = ${JSON.stringify(abi, null, 2)} as const;\n`);
mkdirSync("../indexer/abis", { recursive: true });
writeFileSync("../indexer/abis/HouseVault.json", JSON.stringify(abi, null, 2));
console.log("exported", abi.length, "entries");
