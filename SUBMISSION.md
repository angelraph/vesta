# Vesta: Monad Metropolis submission

Primary track: **Consumer Products & Payments**. Bounties: **Agora cross-border payments**, **Chainlink CRE**, **Envio**, **Mera-Powered UX**, **Mera: One Passkey, Many Keys**.

Submission closes **14 Oct 2026, 04:59 (Lagos time)**. Submit on the 13th.

## Fields

| Field | Value |
|---|---|
| Project name | Vesta |
| One-liner | The bank account for a household, not just a person: a rent pot that pays itself, splits without chasing, and money home in seconds, opened with one passkey. |
| Logo | `brand/vesta-logo-original.png` (or `brand/vesta-icon-512.png` for a square icon) |
| Repository | https://github.com/angelraph/vesta (public, or share with metropolis@hackathon.monad.xyz) |
| Live product | https://vesta-pi-neon.vercel.app |
| Technical demo video (3 min max) | _paste YouTube link for `vesta-demo.mp4`_ |
| Pitch video (2 min max) | _paste YouTube link_ |
| Agora demo (2 min max) | _paste YouTube link for `vesta-agora.mp4`_ |
| Chainlink CRE demo (2 min max) | _paste YouTube link for `vesta-cre.mp4`_ |
| Product ad (30 s, optional) | _optional_ |

### Access instructions for judges

No login, no credentials, nothing to install.

1. Open https://vesta-pi-neon.vercel.app on a phone: Safari on iPhone (iOS 18+) or Chrome on Android.
2. Tap **Get started**, type a name, tap **Create with passkey** and confirm with Face ID or a fingerprint. Some phones then show **Passkey saved, Finish setting up**: tap it once.
3. Your account opens with **$100 of test AUSD**. You can add another $100 any time you hold less than $500 (Home or **Add money**).
4. Tap **Set up a house**, use **I collect the rent myself**, and invite a second phone with **Invite a housemate**. Or just send money home with **Send home**.
5. Stateless test: clear the site's data, reopen, tap **I already have Vesta** and unlock with the same passkey. Name, house, contacts and notes all come back.

A full walkthrough is in [docs/testing-guide.md](docs/testing-guide.md).

## Project description

Vesta is a household account for people who share a home. Housemates pay rent into one shared pot, split bills as they happen, and send money home to family, all from one app opened with a passkey.

We built it for diaspora housemates in the UK who share rent and support family in Nigeria, Ghana and Kenya. Today they juggle a banking app, a spreadsheet in their head, WhatsApp reminders and a remittance service that charges a fee, takes a cut on the rate and still takes days.

In Vesta:

- **The rent pot fills itself.** Everyone pays their share into one pot on Monad. A Chainlink CRE workflow checks every house daily, flags anyone who's short three days before rent day, and pays the landlord on the day once the pot is full. Nobody has to be the one who chases.
- **Splits without the chasing.** Add a cost once, everyone settles with a tap.
- **Money home in seconds, with no fee.** Sends go through Agora's Instant Settlement pair inside the same transaction, so the recipient is paid out immediately, with a receipt they can open on any phone.
- **A steward keeps the books.** Ask "who still owes rent?" and an AI agent answers from the contract and the Envio ledger, with a button or a ready-to-send reminder. It can't move money; the passkey always decides.
- **Your phone is the account.** One Mera passkey creates everything. No seed phrase, no extension, no password. Lose the phone and the same passkey brings the household back.

The blockchain stays invisible: dollars and names on every screen, network fees sponsored, no addresses where a name belongs.

## Consumer track

**Who it's for.** Diaspora housemates in UK cities who share rent and send money to family in West and East Africa. Amina in Hackney with two housemates and a mum in Lagos is our first user, not a persona we invented: our testers come from that community.

**Distribution, the next 100 users.** Houses grow by invitation: one person sets up a house and every housemate joins through a private link, so each sign-up brings two or three more. We start where the users already gather: diaspora student societies and shared-housing WhatsApp groups in London, Manchester and Birmingham, then the recipients themselves, since every money-home receipt carries a "Get Vesta" link.

**User testing.** _Fill in: number of testers who completed the flow, and 2 or 3 quotes._ Feedback so far: "Smooth and fast at the same time" (Ken). Testers found that the steward mentioned a button it hadn't made and that early accounts showed an address instead of a name; both are fixed.

## Agora: how a user sends AUSD across borders

A user signs up with a Mera passkey and lands on an AUSD balance on Monad testnet. In **Send home** they pick a recipient and country (Nigeria, Ghana, Kenya, South Africa and more), enter an amount and see the live rate, a zero fee and exactly what the recipient gets. One passkey confirmation sends it.

The send is `HouseVault.sendHome`, which pulls the AUSD, approves Agora's AUSD/CTK Instant Settlement pair and calls `swapExactTokensForTokens` with a quoted minimum, paying the recipient directly in the same transaction. The vault approved itself as a swapper through Agora's whitelister at deployment. The recipient gets a public receipt page showing the amount, the local-currency value at the day's rate and "Settled by Agora, instantly", plus a link to check it on the explorer. Proof transaction: `0x05c3f43dbb03b51c9507cb26687a82b52bfe353ddb4c2a09fb7ce1eab9a2b2f5`.

## Chainlink CRE: orchestration layer

Rent day in Vesta is a CRE workflow (`cre/rent-day`). On a daily cron it reads every house from `HouseVault` on Monad testnet with the EVM read capability, fetches the live USD exchange rate from an external FX API in node mode with median consensus, and decides per house: rent due and pot full means collect, rent due within three days with a member behind means flag a shortfall. Each decision is encoded and written back as a signed report through the Chainlink forwarder to `HouseVault.onReport`, which only accepts reports from the forwarder. The CRE workflow is the only thing that turns house state plus real-world data into onchain action.

Simulated with `cre workflow simulate rent-day --broadcast` against Monad testnet: a shortfall flagged (`0xdba7b20dfab5d7eef99399fcba6103cad97ff879adf6262a975b530374ffc786`) and, after a top-up, the landlord paid (`0xe23acc6217a14f040d29fcc8cbe12d2b56d5515148997baf862ade9ef6264014`). Both events show up in the app's feed through Envio.

## Envio: real data driving features

Vesta's history is an Envio HyperIndex indexer (`indexer/`), hosted on Envio. It indexes every `HouseVault` event into a household ledger: `Activity` (the feed), `House` (live pot, cycle, totals), `Member` (rent paid, running net balance, shortfall count), `Person`, `RentCycle` and `Expense`, with balances derived in the handlers so the app reads totals straight from GraphQL. It drives three features: the activity feed on Home and Activity, the split history, and the steward's `get_recent_activity` tool, which is how the AI answers "how much have I sent home lately?". Monad's public RPC serves only 100 blocks of logs per call, so the feed would not exist without the indexer.

## Mera: the entire account layer

- **One prompt onboarding.** A single passkey ceremony creates the account. On authenticators that need it, a second tap finishes PRF evaluation behind an explicit "Finish setting up" button, because a passkey request no tap started gets blocked on iOS.
- **Time to first transaction.** In our recorded runs, from tapping **Create with passkey** to a confirmed Monad transaction (the name save) takes about 9 seconds.
- **Session design.** The Mera signing session signs everyday actions (paying rent, adding a split, settling small amounts) without prompts. Sending money home always asks for the passkey again, and so does settling more than $100. The session locks after 15 minutes idle; unlocking is one passkey prompt.
- **Stateless test.** Nothing secret is stored. Clear storage or open a fresh browser and unlock with the passkey: the account, houses (found onchain), name, contacts, steward memory and house notes all reconstruct.
- **Stack composability.** Network fees are sponsored, so the user never holds MON, and test AUSD is granted automatically.

## Mera: one passkey, many keys (non-account work)

The PRF output feeds HKDF with separate namespaces: `vesta/account/v1` (the signing key), `vesta/steward/v1` (an AES key for the AI steward's memory and the encrypted contact list), and `vesta/house/<inviteHash>/v1` (a per-house key that wraps that house's shared key). Two of the three do non-account work:

- **AI agent memory encrypted to the passkey.** The steward's memory and the person's saved recipients are encrypted on the phone and stored onchain as ciphertext. Any device with the passkey decrypts them; nobody else can.
- **Encrypted house notes with per-house keys.** Each house has a random key that travels in the invite link after `#`. Every member stores it onchain wrapped under their own passkey-derived house key, so the Wi-Fi password and door code are readable only by people who live there, on any of their devices.

The cross-device test is the same as the stateless test: a fresh browser with the same passkey decrypts the same memory, contacts and notes.

## Team

angelraph: product, design and engineering.
