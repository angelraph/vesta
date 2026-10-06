# Vesta

The household account. Shared rent, bill splits and money sent home, opened with one passkey.

Built for the Monad Metropolis hackathon (Consumer Products & Payments).

## What's here

| Path | What it is |
|---|---|
| `apps/web` | The app. Next.js, mobile-first, installable on a phone. Mera passkeys are the only account layer. |
| `contracts` | `HouseVault.sol`: rent pot, splits, settling up, send home, encrypted house notes. Hardhat 3 with tests. |

## Run it

```bash
pnpm install
pnpm dev
```

Contracts:

```bash
cd contracts
pnpm test
```

## How it works

- **Accounts.** One Mera passkey ceremony. The PRF output is the root; HKDF derives the Monad signing key, a per-house wrapping key and the steward key, each in its own namespace. Nothing secret is stored anywhere.
- **Money.** AUSD on Monad. Every payment is a real transaction.
- **House notes.** Each house has a random key that travels in the invite link (after `#`, so it never reaches a server). Each member stores it onchain, sealed under their own passkey-derived key.
