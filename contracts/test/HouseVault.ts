import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeAbiParameters, keccak256, parseUnits, toHex, zeroAddress, zeroHash } from "viem";

const usd = (n: string) => parseUnits(n, 6);
const SECRET = toHex("house-12-amhurst", { size: 32 });
const MONTH = 30n * 24n * 3600n;

async function setup() {
  const { viem, networkHelpers } = await network.create();
  const [deployer, amina, tobi, mara, landlord, keeper, outsider] = await viem.getWalletClients();
  const token = await viem.deployContract("TestToken");
  const vault = await viem.deployContract("HouseVault", [token.address, keeper.account.address, zeroAddress, zeroAddress, zeroAddress]);
  for (const w of [amina, tobi, mara, outsider]) {
    await token.write.mint([w.account.address, usd("5000")]);
    await token.write.approve([vault.address, usd("5000")], { account: w.account });
  }
  const now = BigInt(await networkHelpers.time.latest());
  const due = now + 7n * 24n * 3600n;
  await vault.write.createHouse(["12 Amhurst", landlord.account.address, usd("2400"), MONTH, due, keccak256(SECRET), "0xaa"], {
    account: amina.account,
  });
  await vault.write.join([1n, SECRET, "0x"], { account: tobi.account });
  await vault.write.join([1n, SECRET, "0x"], { account: mara.account });
  return { viem, networkHelpers, token, vault, deployer, amina, tobi, mara, landlord, keeper, outsider, due };
}

describe("HouseVault", () => {
  it("creates a house and lets people join with the invite", async () => {
    const { vault, amina, tobi, mara } = await setup();
    const members = await vault.read.membersOf([1n]);
    assert.deepEqual(
      members.map((m) => m.toLowerCase()),
      [amina, tobi, mara].map((w) => w.account.address.toLowerCase()),
    );
    const house = await vault.read.getHouse([1n]);
    assert.equal(house.name, "12 Amhurst");
    assert.deepEqual(await vault.read.housesOf([tobi.account.address]), [1n]);
  });

  it("rejects a wrong invite and double joins", async () => {
    const { vault, outsider, tobi } = await setup();
    await assert.rejects(vault.write.join([1n, zeroHash, "0x"], { account: outsider.account }), /BadInvite/);
    await assert.rejects(vault.write.join([1n, SECRET, "0x"], { account: tobi.account }), /AlreadyMember/);
  });

  it("fills the rent pot and pays the landlord on rent day", async () => {
    const { vault, token, amina, tobi, mara, landlord, networkHelpers, due } = await setup();
    for (const w of [amina, tobi, mara]) await vault.write.payRent([1n, usd("800")], { account: w.account });
    await assert.rejects(vault.write.collectRent([1n]), /NotDue/);
    await networkHelpers.time.increaseTo(due);
    await vault.write.collectRent([1n]);
    assert.equal(await token.read.balanceOf([landlord.account.address]), usd("2400"));
    const house = await vault.read.getHouse([1n]);
    assert.equal(house.pot, 0n);
    assert.equal(house.cycle, 1);
    assert.equal(house.nextDue, due + MONTH);
  });

  it("will not pay out a pot that is short", async () => {
    const { vault, amina, networkHelpers, due } = await setup();
    await vault.write.payRent([1n, usd("800")], { account: amina.account });
    await networkHelpers.time.increaseTo(due);
    await assert.rejects(vault.write.collectRent([1n]), /PotTooLow/);
  });

  it("lets anyone top up rent for a member, like a cross-chain deposit", async () => {
    const { vault, tobi, outsider } = await setup();
    await vault.write.payRentFor([1n, tobi.account.address, usd("300")], { account: outsider.account });
    const [, paid] = await vault.read.rentStatus([1n]);
    assert.equal(paid[1], usd("300"));
  });

  it("tracks a split and settles it between housemates", async () => {
    const { vault, token, amina, tobi, mara } = await setup();
    const people = [amina.account.address, tobi.account.address, mara.account.address];
    await vault.write.addExpense([1n, usd("60"), "Dinner at Mara's", people, [usd("20"), usd("20"), usd("20")]], {
      account: mara.account,
    });
    assert.equal(await vault.read.net([1n, mara.account.address]), usd("40"));
    assert.equal(await vault.read.net([1n, tobi.account.address]), -usd("20"));

    const before = await token.read.balanceOf([mara.account.address]);
    await vault.write.settle([1n, mara.account.address, usd("20")], { account: tobi.account });
    assert.equal(await token.read.balanceOf([mara.account.address]), before + usd("20"));
    assert.equal(await vault.read.net([1n, tobi.account.address]), 0n);
    assert.equal(await vault.read.net([1n, mara.account.address]), usd("20"));
  });

  it("rejects splits that do not add up", async () => {
    const { vault, amina, tobi } = await setup();
    await assert.rejects(
      vault.write.addExpense([1n, usd("50"), "Bills", [amina.account.address, tobi.account.address], [usd("20"), usd("20")]], {
        account: amina.account,
      }),
      /BadSplit/,
    );
  });

  it("sends money home with the corridor and rate on record", async () => {
    const { vault, token, amina, outsider } = await setup();
    await vault.write.sendHome([outsider.account.address, usd("100"), 0n, toHex("NGN"), 1_550_000_000n, "For Mama"], {
      account: amina.account,
    });
    assert.equal(await token.read.balanceOf([outsider.account.address]), usd("5100"));
  });

  it("settles money sent home instantly through the Agora pair", async () => {
    const { viem, token, keeper, amina, outsider } = await setup();
    const local = await viem.deployContract("TestToken");
    const pair = await viem.deployContract("TestPair");
    const vault = await viem.deployContract("HouseVault", [token.address, keeper.account.address, pair.address, local.address, zeroAddress]);
    await token.write.approve([vault.address, usd("100")], { account: amina.account });
    const before = await token.read.balanceOf([amina.account.address]);
    await assert.rejects(
      vault.write.sendHome([outsider.account.address, usd("100"), usd("101") * 10n ** 12n, toHex("NGN"), 1_550_000_000n, ""], {
        account: amina.account,
      }),
      /slippage/,
    );
    await vault.write.sendHome([outsider.account.address, usd("100"), usd("100") * 10n ** 12n, toHex("NGN"), 1_550_000_000n, "For Mama"], {
      account: amina.account,
    });
    assert.equal(await token.read.balanceOf([amina.account.address]), before - usd("100"));
    assert.equal(await local.read.balanceOf([outsider.account.address]), usd("100") * 10n ** 12n);
    assert.equal(await token.read.balanceOf([vault.address]), 0n);
  });

  it("only the keeper can deliver rent-day reports", async () => {
    const { vault, keeper, tobi, amina, mara, networkHelpers, due } = await setup();
    const shortfall = encodeAbiParameters(
      [{ type: "uint8" }, { type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [2, 1n, tobi.account.address, usd("40")],
    );
    await assert.rejects(vault.write.onReport(["0x", shortfall], { account: amina.account }), /NotKeeper/);
    await vault.write.onReport(["0x", shortfall], { account: keeper.account });

    for (const w of [amina, tobi, mara]) await vault.write.payRent([1n, usd("800")], { account: w.account });
    await networkHelpers.time.increaseTo(due);
    const collect = encodeAbiParameters(
      [{ type: "uint8" }, { type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [1, 1n, tobi.account.address, 0n],
    );
    await vault.write.onReport(["0x", collect], { account: keeper.account });
    assert.equal((await vault.read.getHouse([1n])).cycle, 1);
  });

  it("stores encrypted notes only for members", async () => {
    const { vault, amina, outsider } = await setup();
    await vault.write.setHouseNotes([1n, "0xdeadbeef"], { account: amina.account });
    assert.equal(await vault.read.houseNotes([1n]), "0xdeadbeef");
    assert.equal(await vault.read.keyring([1n, amina.account.address]), "0xaa");
    await vault.write.setWrappedKey([1n, "0xbb"], { account: amina.account });
    assert.equal(await vault.read.keyring([1n, amina.account.address]), "0xbb");
    await vault.write.setName(["Amina"], { account: amina.account });
    assert.equal(await vault.read.displayName([amina.account.address]), "Amina");
    await assert.rejects(vault.write.setHouseNotes([1n, "0x01"], { account: outsider.account }), /NotMember/);
  });
});
