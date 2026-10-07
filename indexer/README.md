# Vesta indexer

Envio HyperIndex (v3) for the `HouseVault` contract on Monad testnet. It powers the activity feed, the shared tab history and the steward's view of the house.

## What it builds

| Entity | What it holds |
|---|---|
| `Activity` | One row per thing that happened (rent in, rent out, a split, a payback, money sent home, someone moving in, a shortfall). This is the app's feed. |
| `House` | Rent, the live pot, cycle, next due date, totals for rent collected and shared costs, member count. |
| `Member` | One person in one house: rent paid, running net balance (mirrors the contract), how much they covered for others, shortfall count. |
| `Person` | Display name, total sent home and how many times. |
| `RentCycle` | Each month's rent: how much went in and whether it was paid out. |
| `Expense` | Each shared cost with its participants and shares. |

Balances are derived in the handlers, so the app reads totals straight from GraphQL instead of adding up events on the phone.

## Run

Envio's CLI needs Linux or macOS (on Windows, use WSL).

```bash
pnpm install
pnpm codegen
pnpm test      # runs the real handlers in-process against simulated events
pnpm dev       # local indexer + GraphQL (needs Docker and ENVIO_API_TOKEN)
```

Get a free HyperSync token at https://envio.dev/app/api-tokens.

## Hosted

Deployed on Envio's hosted service as `angelraph/vesta-indexer` (free Development plan). Auto-deploy on push is off, because each deployment gets a new endpoint: redeploy from the Envio dashboard, then update `NEXT_PUBLIC_INDEXER_URL` in the app. Current endpoint: https://indexer.dev.hyperindex.xyz/e32f57e/v1/graphql
