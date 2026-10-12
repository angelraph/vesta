I built a bank account for a household, not just a person.

It's called Vesta, and it's live on Monad testnet today.

Here's the problem. If you share a house, your money life runs on four apps:

• a banking app to pay rent
• a group chat to chase who owes what
• mental maths for every bill
• a remittance app that charges a fee, takes a cut on the rate, and still takes days to send money home

Somebody always ends up being the one who chases.

Vesta puts all of it in one account the whole house shares.

🏠 A rent pot that pays itself
Everyone pays their share into one pot. On rent day a Chainlink CRE workflow checks the house, flags anyone who's short three days early, and pays the landlord once the pot is full. Nobody has to chase.

🧾 Splits without the chasing
Add a shared cost once. Everyone sees their share and settles with one tap.

🌍 Money home in seconds, no fee
Send to family in Nigeria, Ghana, Kenya and more. It settles instantly through Agora's Instant Settlement on Monad, and your family gets a receipt they can open on any phone. They can cash it out back into dollars from their own Vesta account.

🔐 Your phone lock is the account
No password. No email. No seed phrase. One Mera passkey creates everything, and it works with whatever unlocks your phone: fingerprint, face, PIN or pattern. Lose your phone and the same passkey brings the whole household back.

🤖 A steward that keeps the books
Ask "who still owes rent?" and an AI steward answers from the contract and the Envio ledger, then drafts the reminder for you. It can't move money. Your passkey always decides.

The blockchain stays invisible. You see dollars and names, not addresses. Network fees are sponsored.

This week I gave it to friends, with real testnet transactions, nothing faked:

• 8 people moved into one house on Vesta
• 7 of them joined through an invite link
• all 8 paid their rent share
• 6 of them sent money home

What they said:

"Sign in / log-in is sharp, sharp, and smooth. Paid my rent, all is dope so far"
"Smooth and fast at the same time"
"App looks solid, man. Good job"

Every bug they hit got fixed the same day. A broken invite link now explains itself. A friend with only a pattern lock thought she couldn't sign up, so the app now says any phone lock works. Someone asked "how does Mama withdraw?", and that became a Cash out screen.

Built on:
• Monad: every payment settles in about a second
• Mera: one passkey is the whole account
• Agora: instant cross-border settlement in AUSD
• Chainlink CRE: rent day runs itself
• Envio: the household ledger

I built it solo (product, design and engineering) for Monad Metropolis, for people I know: housemates in the UK who pay rent together and support family back home.

Try it on your phone (Chrome on Android, Safari on iPhone):
https://vesta-pi-neon.vercel.app

Watch the demo: https://youtu.be/eiCX7MlDyeM
Code: https://github.com/angelraph/vesta

Vesta. Money for the people you live with.
