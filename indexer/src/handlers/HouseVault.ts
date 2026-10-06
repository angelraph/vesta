import { indexer, type EvmOnEventContext } from "envio";

// Every handler writes one Activity row for the app's feed, and keeps the
// aggregate entities (House, Member, Person, RentCycle) up to date so the app
// never has to add things up on the device.

const fields = { transaction: ["hash"], block: ["timestamp"] } as const;

type Ctx = EvmOnEventContext;

const memberId = (houseId: bigint | string, who: string) => `${houseId}-${who}`;
const cycleId = (houseId: bigint | string, cycle: bigint | number) => `${houseId}-${cycle}`;

function ascii(hex: string) {
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code) out += String.fromCharCode(code);
  }
  return out;
}

async function person(context: Ctx, id: string) {
  return (
    (await context.Person.get(id)) ?? {
      id,
      name: undefined,
      sentHomeTotal: 0n,
      sendHomeCount: 0,
    }
  );
}

async function cycle(context: Ctx, houseId: bigint, n: bigint) {
  const id = cycleId(houseId, n);
  return (
    (await context.RentCycle.get(id)) ?? {
      id,
      house_id: houseId.toString(),
      cycle: Number(n),
      paidIn: 0n,
      collected: false,
      collectedAt: undefined,
    }
  );
}

function activity(
  context: Ctx,
  e: { transaction: { hash: string }; block: { timestamp: number }; logIndex: number },
  row: {
    kind: string;
    houseId?: bigint;
    actor: string;
    counterparty?: string;
    amount?: bigint;
    memo?: string;
    corridor?: string;
    fxRate?: bigint;
  },
) {
  context.Activity.set({
    id: `${e.transaction.hash}-${e.logIndex}`,
    kind: row.kind,
    houseId: row.houseId?.toString(),
    actor: row.actor,
    counterparty: row.counterparty,
    amount: row.amount ?? 0n,
    memo: row.memo,
    corridor: row.corridor,
    fxRate: row.fxRate,
    timestamp: e.block.timestamp,
    txHash: e.transaction.hash,
  });
}

indexer.onEvent({ contract: "HouseVault", event: "HouseCreated", fields }, async ({ event, context }) => {
  const { houseId, creator, name, landlord, rent, period, firstDue } = event.params;
  context.House.set({
    id: houseId.toString(),
    name,
    creator,
    landlord,
    rent,
    period,
    nextDue: firstDue,
    cycle: 0,
    pot: 0n,
    rentCollectedTotal: 0n,
    expensesTotal: 0n,
    memberCount: 0,
    createdAt: event.block.timestamp,
  });
  context.Person.set(await person(context, creator));
  activity(context, event, { kind: "created", houseId, actor: creator, amount: rent, memo: name });
});

indexer.onEvent({ contract: "HouseVault", event: "MemberJoined", fields }, async ({ event, context }) => {
  const { houseId, member } = event.params;
  const house = await context.House.get(houseId.toString());
  if (house) context.House.set({ ...house, memberCount: house.memberCount + 1 });
  context.Person.set(await person(context, member));
  context.Member.set({
    id: memberId(houseId, member),
    house_id: houseId.toString(),
    person_id: member,
    joinedAt: event.block.timestamp,
    rentPaidTotal: 0n,
    net: 0n,
    paidForOthers: 0n,
    shortfalls: 0,
  });
  // The creator joins in the same transaction as HouseCreated; one row is enough.
  if (house && house.creator !== member) activity(context, event, { kind: "joined", houseId, actor: member });
});

indexer.onEvent({ contract: "HouseVault", event: "NameSet" }, async ({ event, context }) => {
  const p = await person(context, event.params.member);
  context.Person.set({ ...p, name: event.params.name });
});

indexer.onEvent({ contract: "HouseVault", event: "RentPaid", fields }, async ({ event, context }) => {
  const { houseId, member, payer, cycle: n, amount } = event.params;
  const house = await context.House.get(houseId.toString());
  if (house) context.House.set({ ...house, pot: house.pot + amount });

  const m = await context.Member.get(memberId(houseId, member));
  if (m) context.Member.set({ ...m, rentPaidTotal: m.rentPaidTotal + amount });
  if (payer !== member) {
    const p = await context.Member.get(memberId(houseId, payer));
    if (p) context.Member.set({ ...p, paidForOthers: p.paidForOthers + amount });
  }

  const c = await cycle(context, houseId, n);
  context.RentCycle.set({ ...c, paidIn: c.paidIn + amount });

  activity(context, event, { kind: "rent", houseId, actor: member, counterparty: payer !== member ? payer : undefined, amount });
});

indexer.onEvent({ contract: "HouseVault", event: "RentCollected", fields }, async ({ event, context }) => {
  const { houseId, cycle: n, landlord, amount, nextDue } = event.params;
  const house = await context.House.get(houseId.toString());
  if (house) {
    context.House.set({
      ...house,
      pot: house.pot - amount,
      cycle: Number(n) + 1,
      nextDue,
      rentCollectedTotal: house.rentCollectedTotal + amount,
    });
  }
  const c = await cycle(context, houseId, n);
  context.RentCycle.set({ ...c, collected: true, collectedAt: event.block.timestamp });
  activity(context, event, { kind: "collect", houseId, actor: house?.creator ?? landlord, counterparty: landlord, amount });
});

indexer.onEvent({ contract: "HouseVault", event: "RentShortfall", fields }, async ({ event, context }) => {
  const { houseId, member, shortBy } = event.params;
  const m = await context.Member.get(memberId(houseId, member));
  if (m) context.Member.set({ ...m, shortfalls: m.shortfalls + 1 });
  activity(context, event, { kind: "shortfall", houseId, actor: member, amount: shortBy });
});

indexer.onEvent({ contract: "HouseVault", event: "ExpenseAdded", fields }, async ({ event, context }) => {
  const { houseId, expenseId, payer, amount, memo, participants, shares } = event.params;

  const house = await context.House.get(houseId.toString());
  if (house) context.House.set({ ...house, expensesTotal: house.expensesTotal + amount });

  // Mirror the contract: the payer is owed the whole bill, each participant owes their share.
  const deltas = new Map<string, bigint>([[payer, amount]]);
  participants.forEach((who, i) => deltas.set(who, (deltas.get(who) ?? 0n) - (shares[i] ?? 0n)));
  for (const [who, delta] of deltas) {
    const m = await context.Member.get(memberId(houseId, who));
    if (m) context.Member.set({ ...m, net: m.net + delta });
  }

  context.Expense.set({
    id: expenseId.toString(),
    house_id: houseId.toString(),
    payer,
    amount,
    memo,
    participants: [...participants],
    shares: [...shares],
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
  activity(context, event, { kind: "expense", houseId, actor: payer, amount, memo });
});

indexer.onEvent({ contract: "HouseVault", event: "Settled", fields }, async ({ event, context }) => {
  const { houseId, from, to, amount } = event.params;
  const a = await context.Member.get(memberId(houseId, from));
  if (a) context.Member.set({ ...a, net: a.net + amount });
  const b = await context.Member.get(memberId(houseId, to));
  if (b) context.Member.set({ ...b, net: b.net - amount });
  activity(context, event, { kind: "settle", houseId, actor: from, counterparty: to, amount });
});

indexer.onEvent({ contract: "HouseVault", event: "SentHome", fields }, async ({ event, context }) => {
  const { from, to, amount, corridor, fxRate, memo } = event.params;
  const p = await person(context, from);
  context.Person.set({ ...p, sentHomeTotal: p.sentHomeTotal + amount, sendHomeCount: p.sendHomeCount + 1 });
  activity(context, event, {
    kind: "sent",
    actor: from,
    counterparty: to,
    amount,
    memo: memo || undefined,
    corridor: ascii(corridor),
    fxRate,
  });
});
