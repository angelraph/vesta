<p align="center"><img src="media/banner.png" alt="Vesta: the bank account for a household, not just a person" width="100%"></p>

<p align="center">
  <a href="https://vesta-pi-neon.vercel.app"><b>Try the live app</b></a> ·
  <a href="https://youtu.be/eiCX7MlDyeM"><b>Demo video (1:53)</b></a> ·
  <a href="https://youtu.be/Iok-Ll3hu8U">Pitch (1:59)</a> ·
  <a href="#product-tour">Product tour</a> ·
  <a href="docs/testing-guide.md">Testing guide</a> ·
  <a href="SUBMISSION.md">Submission</a> ·
  <a href="https://sourcify.dev/server/repo-ui/10143/0x1cb8182e22e7716f9dc9174f1be7591157288559">Verified contract</a>
</p>

<p align="center">
  <a href="https://github.com/angelraph/vesta/actions/workflows/ci.yml"><img src="https://github.com/angelraph/vesta/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

# Vesta

**The bank account for a household, not just a person.** Shared rent, bill splits and money sent home, in one app you open the way you unlock your phone: fingerprint, face, PIN or pattern. Live on Monad testnet, so the money is test money.

Built for the Monad Metropolis hackathon (Consumer Products & Payments).

[![Watch the Vesta demo (1:53)](media/demo-thumbnail.png)](https://youtu.be/eiCX7MlDyeM)

*Watch the 1:53 demo on YouTube. Every clip is the live app on Monad testnet: two phones with real passkeys, real transactions, nothing mocked. How it was made is in [video/](video).*

## At a glance

| | |
|---|---|
| **Live app** | https://vesta-pi-neon.vercel.app, installable on a phone |
| **Network** | Monad testnet (chain 10143). Every payment, split and rent cycle is a real transaction |
| **Accounts** | One Mera passkey. No password, no seed phrase, no custody backend |
| **Money home** | AUSD, settled instantly through Agora's Instant Settlement pair inside the send |
| **Rent day** | A Chainlink CRE workflow pays the landlord or flags who's short, checked live with `--broadcast` |
| **History** | Envio HyperIndex household ledger, hosted |
| **Steward** | An AI agent with read-only tools over the house; it suggests, the passkey decides |
| **Contracts** | `HouseVault` and `GasTap`, both [verified on Sourcify](https://sourcify.dev/server/repo-ui/10143/0x1cb8182e22e7716f9dc9174f1be7591157288559) |
| **Tests** | 11 contract tests, CI on every push (contract tests, app types and lint, workflow types), and two-phone end-to-end runs on testnet |
| **Real use** | 8 people in one real house: 7 joined by invite link, 8 of 8 paid rent, 7 sends home by 6 people ([Real use](#real-use)) |

## Contents

- [The problem](#the-problem) · [What Vesta does](#what-vesta-does) · [Product tour](#product-tour) · [Videos](#videos)
- [How it fits together](#how-it-fits-together) · [Real use](#real-use) · [Who it's for first](#who-its-for-first)
- [Live on Monad testnet](#live-on-monad-testnet) · [Verification](#verification) · [Security and privacy](#security-and-privacy)
- [Build log](#build-log) · [Run it](#run-it) · [Documentation](#documentation) · [Risks and limits](#risks-and-limits)

## The problem

Amina lives in Hackney with two housemates. Her mum lives in Lagos. Every month she:

- **chases rent** over WhatsApp and hopes the landlord gets paid on time
- **keeps a mental tab** of who paid for dinner, the electric bill and the toilet roll
- **sends money home** through a service that charges a fee, takes a cut on the rate and still takes days

That's three apps, a spreadsheet in her head and a lot of awkward conversations. Banks are built for one person. Real life money is shared: a house, a family, people in two countries.

## What Vesta does

| Before | With Vesta |
|---|---|
| One person fronts the rent and chases everyone else | Everyone pays their share into one **rent pot**. On rent day it pays the landlord by itself. |
| Nobody knows who's short until the landlord calls | Three days before rent day, the house sees who's behind. Nobody has to be the one who chases. |
| "I'll pay you back for dinner" and then nobody does | Add the cost once, everyone **settles with one tap**. |
| Money home costs a fee and takes days | Money home arrives **in seconds with no fee**, settled instantly through Agora. |
| Family can't do anything with what arrives | Mama taps **Cash out** and converts it back to dollars to spend, send or split. |
| Passwords, seed phrases, wallet apps | **One passkey.** Your phone is the account. Lose it, and your passkey brings everything back. |
| Nobody keeps the books | A **steward** (an AI agent) answers "who still owes rent?" and hands you a button to fix it. |

## Product tour

Every screen below is a real screenshot of the live app on Monad testnet, taken by a script that signs up three housemates with passkeys and runs the whole flow ([video/screens.py](video/screens.py)).

![Sign up with a passkey](media/tour-onboarding.png)

![The rent pot](media/tour-rent.png)

![Splits](media/tour-split.png)

![Money home](media/tour-send.png)

![The steward](media/tour-steward.png)

## Videos

| Video | Length | What it shows |
|---|---|---|
| [Demo](https://youtu.be/eiCX7MlDyeM) | 1:53 | The whole product on two phones: sign-up, house, rent, splits, money home, steward, and the passkey restore |
| [Pitch](https://youtu.be/Iok-Ll3hu8U) | 1:59 | angelraph on the team, the problem, the product, why now, and real tester numbers |
| [Agora](https://youtu.be/5FVoWxUVAwE) | 1:30 | Passkey onboarding, AUSD balance, a send settled instantly through Agora, the onchain proof and the receipt |
| [Chainlink CRE](https://youtu.be/zCBrN_YgxQ4) | 1:42 | The rent-day workflow's code, two real `--broadcast` runs, and the shortfall and payout onchain |

The files are also in [media/videos](media/videos).

## How it fits together

```mermaid
flowchart LR
    subgraph House["🏠 The house"]
        A["Amina"]
        T["Tobi"]
        M["Mara"]
    end

    A & T & M -->|"phone lock<br/>(Mera passkey)"| App["Vesta app<br/>on your phone"]

    App -->|"pay rent, split, settle"| Vault["HouseVault<br/>on Monad"]
    App -->|"send home"| Agora["Agora<br/>Instant Settlement"]
    Agora -->|"paid out in seconds"| Mama["👩🏾 Mama in Lagos"]

    CRE["⏰ Chainlink CRE<br/>rent-day workflow"] -->|"pot full: pay landlord<br/>short: flag it"| Vault
    FX["🌍 Live FX rate"] --> CRE
    Vault -->|"rent day"| Landlord["🔑 Landlord"]

    Vault -->|"every event"| Envio["Envio indexer<br/>household ledger"]
    Envio --> Feed["Activity feed"]
    Envio --> Steward["🤖 Steward<br/>(AI agent)"]
    Steward -->|"answers + buttons"| App
```

1. **You sign in once** with a passkey. Mera's PRF output becomes the root key, and separate keys are derived from it for signing, for each house and for the steward's memory. Nothing secret is stored on a server.
2. **Money lives in HouseVault** on Monad: the rent pot, who has paid this cycle, who owes whom from shared costs.
3. **Money home** goes through Agora's Instant Settlement pair inside the same transaction, so the recipient is paid out immediately.
4. **Rent day runs itself.** A Chainlink CRE workflow checks every house daily with a live exchange rate and either pays the landlord or flags who's short.
5. **Envio indexes everything** into a household ledger that powers the feed and gives the steward its memory of what happened.
6. **The steward** reads the house and the ledger through AI tool calls (OpenAI), answers in plain words and suggests actions. It can never move money itself. Your passkey always has the last word.

## Real use

Friends tested Vesta on their own phones this week, with real testnet transactions. Numbers read from the Envio indexer on 12 Oct 2026:

| | |
|---|---|
| People in one real house ("angelraph apartment") | **8** |
| Joined through the invite link | **7**, the growth loop working: one sign-up brings the house |
| Paid their rent share into the pot | **8 of 8** |
| Shared costs split | **3** |
| Sends home | **7**, by 6 different people |
| Houses set up by a tester | A second tester created a house of her own |

> "The app is nice... Very fast.. Sign in / log-in is sharp, sharp, and smooth.. Paid my rent, all is dope so far"
>
> "Smooth and fast at the same time" (Ken)
>
> "App looks solid, man. Good job" (MrNetwork)

What testing changed, each fixed the same day:

- A cut-off invite link showed a dead end. It now says what went wrong, and a network hiccup gets a Try again button.
- A new housemate could hit "couldn't top up network fees" right after sign-up, when two sponsor sends collided. They now retry, and every RPC call rides out Monad's public rate limit.
- A tester with only a pattern lock thought she couldn't sign up. The app now says any phone lock works, and a passkey prompt that never answers stops after a minute with advice instead of spinning.
- A recipient asked how Mama withdraws. Money received from abroad now has a **Cash out** screen that converts it back to dollars through Agora.

## Who it's for first

Diaspora housemates in the UK who share rent and send money home to Nigeria, Ghana and Kenya. Millions of people feel this every month, and today they patch it together with bank transfers, WhatsApp reminders and remittance apps.

## What's here

| Path | What it is |
|---|---|
| `apps/web` | The app. Next.js, mobile-first, installable on a phone. Mera passkeys are the only account layer. |
| `contracts` | `HouseVault.sol`: rent pot, splits, settling up, send home through Agora, encrypted house notes, CRE report receiver. Hardhat 3 with tests. |
| `cre` | Chainlink CRE rent-day workflow. Reads every house, checks the FX rate, pays the landlord or flags who is short. |
| `indexer` | Envio HyperIndex. Indexes HouseVault into a household ledger (feed, balances, rent cycles). |
| `docs` | Testing guide for new users. |
| `media` | README images built from real screenshots, and the four videos. |
| `video` | The scripts that recorded and edited the videos, took the screenshots and built the pitch, plus the two-phone cash-out test. |
| `brand` | The Vesta mark as SVG, the original logo and app icons. |

## Built with

| | Used for |
|---|---|
| **Monad** | Every payment, split and rent cycle is a real testnet transaction. |
| **Mera** | Passkey accounts, with PRF-derived keys for signing, house notes and steward memory. |
| **Agora** | AUSD balances and instant settlement for money sent home. |
| **Chainlink CRE** | The rent-day workflow that pays the landlord or flags shortfalls. |
| **Envio** | The household ledger behind the activity feed and the steward. |
| **OpenAI** | The steward: tool calling over the house, the ledger and live FX rates. |

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

Rent-day workflow:

```bash
cd cre
cre workflow simulate rent-day --target staging-settings
```

## Live on Monad testnet

| | Address |
|---|---|
| HouseVault (verified) | [`0x1cb8182e22e7716f9dc9174f1be7591157288559`](https://sourcify.dev/server/repo-ui/10143/0x1cb8182e22e7716f9dc9174f1be7591157288559) |
| GasTap (verified) | [`0x48fc665129ac0007f2c8d6d9ac9784f8650841cd`](https://sourcify.dev/server/repo-ui/10143/0x48fc665129ac0007f2c8d6d9ac9784f8650841cd) |
| AUSD | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| Agora AUSD/CTK pair | `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae` |
| Envio GraphQL | https://indexer.dev.hyperindex.xyz/e32f57e/v1/graphql |

### Proof transactions

| What | Transaction |
|---|---|
| Money home, settled by Agora in one transaction | [`0x05c3…b2f5`](https://testnet.monadexplorer.com/tx/0x05c3f43dbb03b51c9507cb26687a82b52bfe353ddb4c2a09fb7ce1eab9a2b2f5) |
| CRE rent day: shortfall flagged | [`0xdba7…c786`](https://testnet.monadexplorer.com/tx/0xdba7b20dfab5d7eef99399fcba6103cad97ff879adf6262a975b530374ffc786) |
| CRE rent day: landlord paid | [`0xe23a…4014`](https://testnet.monadexplorer.com/tx/0xe23acc6217a14f040d29fcc8cbe12d2b56d5515148997baf862ade9ef6264014) |
| Cash out: money received from abroad converted back to AUSD through Agora | [`0x0d13…3065`](https://testnet.monadexplorer.com/tx/0x0d131c5a44d969e98ce55e2ce9144dc74e41d5a9983a189f917734e301203065) |

## Verification

| Check | How |
|---|---|
| Contract tests | 11 Hardhat tests for `HouseVault` (`cd contracts && pnpm test`), run in CI on every push |
| App | TypeScript and lint in CI, with route types generated first |
| Rent-day workflow | Types checked in CI; two live `--broadcast` runs against Monad testnet (above) |
| Contract source | `HouseVault` and `GasTap` verified on Sourcify |
| End to end | Two virtual phones with PRF passkeys run the real flow on testnet: [video/screens.py](video/screens.py) (sign-up, house, rent, splits, money home, steward) and [video/cashout_test.py](video/cashout_test.py) (send home, then cash out) |
| Real people | 8 testers on their own phones, every transaction on the indexer ([Real use](#real-use)) |

## Security and privacy

- **No custody.** Keys are derived on the phone from the passkey's PRF output and never leave it. The server only sponsors network fees and hands out test money.
- **Separate keys for separate jobs.** The signing key, each house's key and the steward's memory key come from the same passkey through different HKDF namespaces, so one never reveals another.
- **Encrypted house data.** House notes and the steward's memory are stored onchain as ciphertext. The house key travels in the invite link after `#`, which browsers never send to a server.
- **Rent can't be paid out early.** `collectRent` checks the due date and the pot. Rent-day reports are only accepted from the Chainlink forwarder.
- **The steward can't move money.** It has read-only tools. Every payment needs the person's passkey.
- **Session lock.** The app locks itself after 15 minutes without use.

## Build log

| Date | Milestone |
|---|---|
| 2026-10-05 | Project created for Monad Metropolis, Consumer Products & Payments track |
| 2026-10-06 | `HouseVault` on Monad testnet, Mera passkey accounts, the app designed as a consumer fintech product, Envio household ledger, the first steward |
| 2026-10-07 | Money home settled through Agora Instant Settlement; hosted Envio indexer |
| 2026-10-08 | Chainlink CRE rent-day workflow, with live `--broadcast` runs |
| 2026-10-09 | Steward on OpenAI tool calls, pay-what-you-can rent, generous test money, sign-up fixes, a landing page with real motion, the demo recorder and video composer |
| 2026-10-10 | CI, names everywhere instead of addresses, GasTap contract for sponsored fees, `SUBMISSION.md`, README with banner, videos and product tour |
| 2026-10-11 | First testers: clearer invite errors, link previews for the site and invite links |
| 2026-10-12 | 8 people in one real house. Fixes from their feedback: sponsor retries, RPC rate limits, any phone lock, passkey timeout. **Cash out** for money received from abroad. Pitch video in angelraph's own voice. Entry submitted |

## Documentation

| | |
|---|---|
| [SUBMISSION.md](SUBMISSION.md) | Every hackathon form answer, video links and proof transactions |
| [docs/testing-guide.md](docs/testing-guide.md) | Step-by-step guide for a new tester |
| [indexer/README.md](indexer/README.md) | The Envio indexer and its hosted endpoint |
| [video/pitch-script.md](video/pitch-script.md) | The pitch script |

## Risks and limits

- Vesta runs on **Monad testnet** with test AUSD. The money is not real yet.
- `HouseVault` has **not had an external audit**. It holds pooled rent, so an audit comes before any mainnet launch.
- Money home is paid out in Agora's testnet pair token (CTK) standing in for a local-currency stablecoin. The recipient can convert it back to AUSD in the app today; cash-out to banks and mobile money in naira, cedis or shillings needs a licensed payout partner, and the app says so instead of faking it.
- The rent-day workflow runs as a CRE **simulation with `--broadcast`**. Deploying it to the CRE network needs deployment access from Chainlink.
- Passkeys with PRF need **iOS 18+ Safari or Chrome on Android**, and a phone with a screen lock of any kind (fingerprint, face, PIN or pattern). In-app browsers (WhatsApp, Instagram, Facebook, Telegram) are detected and told to open the link in a browser.
- The steward runs on OpenAI, so its answers are only as good as the model; every number it gives comes from a tool call against the contract or the indexer.
