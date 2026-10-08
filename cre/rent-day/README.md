# Rent day (Chainlink CRE)

The workflow that runs rent day for every Vesta house. Once a day it:

1. Reads every house from `HouseVault` on Monad testnet (rent, pot, due date, who has paid this cycle).
2. Fetches the live USD exchange rate from an FX API. Each node fetches it and the network agrees on the median.
3. Sends a signed report back to the vault through the Chainlink forwarder:
   - rent is due and the pot is full: **pay the landlord** (`collectRent`)
   - rent is due within three days and someone is behind: **flag the shortfall** (`RentShortfall`), which shows up in the house feed and the steward

The vault only accepts reports from the forwarder (`onReport`, `keeper`), so nobody else can trigger a payout early or flag a housemate.

## Run it

```bash
bun install --cwd ./rent-day
cre workflow simulate rent-day --target staging-settings
```

Add `--broadcast` (with `CRE_ETH_PRIVATE_KEY` set) to write the reports to Monad testnet for real.

## Proof

Live runs on Monad testnet against house 1:

- Flagged a $1 shortfall: `0x4fbed08a13b5f0556f8b5b9edccad4ad1fb5bfcd7ec1f687c0927bf0f6d3e0c8`
- Paid the landlord $2 once the pot was full: `0xcb4bd58937459c19fe9b49cecfb80b7deee1755bdb991b08d391965fc3a61a0a`
