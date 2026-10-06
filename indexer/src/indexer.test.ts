import { describe, expect, it } from "vitest";
import { createTestIndexer, TestHelpers } from "envio";

const [amina, tobi, mara, landlord, mama] = TestHelpers.Addresses.mockAddresses.map((a) => a.toLowerCase());
const usd = (n: number) => BigInt(Math.round(n * 1e6));
const CHAIN = 10143;

let n = 0;
const meta = () => {
  n += 1;
  return {
    block: { number: 68_600_000 + n, timestamp: 1_791_000_000 + n * 60 },
    transaction: { hash: `0x${n.toString(16).padStart(64, "0")}` },
    logIndex: 0,
  };
};

describe("Vesta household ledger", () => {
  it("tracks a month in a shared house", async () => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [CHAIN]: {
          simulate: [
            {
              contract: "HouseVault",
              event: "HouseCreated",
              params: { houseId: 1n, creator: amina, name: "12 Amhurst", landlord, rent: usd(2400), period: 2_592_000n, firstDue: 1_791_600_000n },
              ...meta(),
            },
            { contract: "HouseVault", event: "MemberJoined", params: { houseId: 1n, member: amina }, ...meta() },
            { contract: "HouseVault", event: "MemberJoined", params: { houseId: 1n, member: tobi }, ...meta() },
            { contract: "HouseVault", event: "MemberJoined", params: { houseId: 1n, member: mara }, ...meta() },
            { contract: "HouseVault", event: "NameSet", params: { member: amina, name: "Amina" }, ...meta() },
            { contract: "HouseVault", event: "RentPaid", params: { houseId: 1n, member: amina, payer: amina, cycle: 0n, amount: usd(800) }, ...meta() },
            { contract: "HouseVault", event: "RentPaid", params: { houseId: 1n, member: tobi, payer: mara, cycle: 0n, amount: usd(760) }, ...meta() },
            {
              contract: "HouseVault",
              event: "ExpenseAdded",
              params: {
                houseId: 1n,
                expenseId: 1n,
                payer: mara,
                amount: usd(60),
                memo: "Dinner at Mara's",
                participants: [amina, tobi, mara],
                shares: [usd(20), usd(20), usd(20)],
              },
              ...meta(),
            },
            { contract: "HouseVault", event: "Settled", params: { houseId: 1n, from: tobi, to: mara, amount: usd(20) }, ...meta() },
            {
              contract: "HouseVault",
              event: "SentHome",
              params: { from: amina, to: mama, amount: usd(100), corridor: "0x4e474e", fxRate: 1_330_000_000n, memo: "For Sunday" },
              ...meta(),
            },
            { contract: "HouseVault", event: "RentShortfall", params: { houseId: 1n, member: tobi, cycle: 0n, shortBy: usd(40) }, ...meta() },
          ],
        },
      },
    });

    const house = await indexer.House.getOrThrow("1");
    expect(house.name).toBe("12 Amhurst");
    expect(house.memberCount).toBe(3);
    expect(house.pot).toBe(usd(1560));
    expect(house.expensesTotal).toBe(usd(60));

    const mTobi = await indexer.Member.getOrThrow(`1-${tobi}`);
    expect(mTobi.rentPaidTotal).toBe(usd(760));
    expect(mTobi.net).toBe(0n); // owed 20 for dinner, then paid it back
    expect(mTobi.shortfalls).toBe(1);

    const mMara = await indexer.Member.getOrThrow(`1-${mara}`);
    expect(mMara.net).toBe(usd(20)); // paid 60, own share 20, Tobi paid 20 back
    expect(mMara.paidForOthers).toBe(usd(760));

    const pAmina = await indexer.Person.getOrThrow(amina);
    expect(pAmina.name).toBe("Amina");
    expect(pAmina.sentHomeTotal).toBe(usd(100));
    expect(pAmina.sendHomeCount).toBe(1);

    const feed = await indexer.Activity.getAll();
    const kinds = feed.sort((a, b) => a.timestamp - b.timestamp).map((a) => a.kind);
    // The creator's own join is folded into "created".
    expect(kinds).toEqual(["created", "joined", "joined", "rent", "rent", "expense", "settle", "sent", "shortfall"]);
    const sent = feed.find((a) => a.kind === "sent")!;
    expect(sent.corridor).toBe("NGN");
    expect(sent.counterparty).toBe(mama);
    const coveredRent = feed.find((a) => a.kind === "rent" && a.actor === tobi)!;
    expect(coveredRent.counterparty).toBe(mara);
  });

  it("pays out rent and opens the next cycle", async () => {
    const indexer = createTestIndexer();
    await indexer.process({
      chains: {
        [CHAIN]: {
          simulate: [
            {
              contract: "HouseVault",
              event: "HouseCreated",
              params: { houseId: 2n, creator: amina, name: "Flat 4", landlord, rent: usd(1000), period: 2_592_000n, firstDue: 1_791_000_100n },
              ...meta(),
            },
            { contract: "HouseVault", event: "MemberJoined", params: { houseId: 2n, member: amina }, ...meta() },
            { contract: "HouseVault", event: "RentPaid", params: { houseId: 2n, member: amina, payer: amina, cycle: 0n, amount: usd(1000) }, ...meta() },
            {
              contract: "HouseVault",
              event: "RentCollected",
              params: { houseId: 2n, cycle: 0n, landlord, amount: usd(1000), nextDue: 1_793_592_100n },
              ...meta(),
            },
          ],
        },
      },
    });

    const house = await indexer.House.getOrThrow("2");
    expect(house.pot).toBe(0n);
    expect(house.cycle).toBe(1);
    expect(house.rentCollectedTotal).toBe(usd(1000));
    expect(house.nextDue).toBe(1_793_592_100n);
    const cycle0 = await indexer.RentCycle.getOrThrow("2-0");
    expect(cycle0.collected).toBe(true);
    expect(cycle0.paidIn).toBe(usd(1000));
  });
});
