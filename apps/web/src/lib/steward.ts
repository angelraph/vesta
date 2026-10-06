import "server-only";
import { erc20Abi, formatUnits, isAddress, type Address } from "viem";
import { houseVaultAbi } from "./abi/houseVault";
import { addresses, AUSD_DECIMALS } from "./config";
import { serverPublic } from "./server";

// The steward is a Kimi agent with read-only tools over the house. It can
// suggest an action, but only the person can carry it out, with their passkey.

const KIMI_URL = "https://api.moonshot.ai/v1/chat/completions";
const MODEL = process.env.KIMI_MODEL ?? "kimi-k3";
const INDEXER = process.env.NEXT_PUBLIC_INDEXER_URL;

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; reasoning_content?: string; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type StewardCard =
  | { type: "action"; action: "pay_rent" | "settle" | "send_home"; amount?: number; to?: string; label: string }
  | { type: "message"; to: string; text: string }
  | { type: "remember"; fact: string };

const usd = (v: bigint) => Number(formatUnits(v, AUSD_DECIMALS));
const vault = { address: addresses.houseVault, abi: houseVaultAbi } as const;

const tools = [
  {
    type: "function",
    function: {
      name: "get_house_status",
      description:
        "Current state of the person's house: rent, rent day, how full the rent pot is, each housemate's share and what they still owe, and who owes whom from shared costs. Amounts are in US dollars.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_activity",
      description: "Recent things that happened: rent paid in, rent paid out, shared costs, paybacks, money sent home. Newest first.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "How many items, 1 to 30", default: 10 },
          kind: { type: "string", enum: ["rent", "collect", "expense", "settle", "sent", "joined", "shortfall"], description: "Only this kind" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_balance",
      description: "The person's own spendable balance in US dollars.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_exchange_rate",
      description: "Today's mid-market rate from 1 US dollar to a currency, e.g. NGN, GHS, KES, GBP.",
      parameters: { type: "object", properties: { currency: { type: "string" } }, required: ["currency"] },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_action",
      description:
        "Offer the person a button to do something. You cannot do it yourself; they confirm it in the app. Use for paying their rent share, paying a housemate back, or sending money home.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["pay_rent", "settle", "send_home"] },
          amount: { type: "number", description: "US dollars" },
          to: { type: "string", description: "Housemate or recipient name, if relevant" },
          label: { type: "string", description: "Short button text, e.g. 'Pay your share, $400'" },
        },
        required: ["action", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_message",
      description: "Write a short, friendly message the person can send to a housemate, like a rent reminder. Warm, casual, never pushy.",
      parameters: { type: "object", properties: { to: { type: "string" }, text: { type: "string" } }, required: ["to", "text"] },
    },
  },
  {
    type: "function",
    function: {
      name: "remember",
      description:
        "Save a short fact about the person's habits or preferences that will help later, e.g. 'Sends money to Mama on the 1st'. It is stored encrypted to their passkey. Don't save anything sensitive like passwords.",
      parameters: { type: "object", properties: { fact: { type: "string" } }, required: ["fact"] },
    },
  },
] as const;

async function houseStatus(me: Address, houseId: bigint | null) {
  if (!houseId) return { inHouse: false };
  const [h, [addrs, paid, share]] = await Promise.all([
    serverPublic.readContract({ ...vault, functionName: "getHouse", args: [houseId] }),
    serverPublic.readContract({ ...vault, functionName: "rentStatus", args: [houseId] }),
  ]);
  const extra = await serverPublic.multicall({
    contracts: addrs.flatMap((a) => [
      { ...vault, functionName: "displayName", args: [a] } as const,
      { ...vault, functionName: "net", args: [houseId, a] } as const,
    ]),
    allowFailure: false,
  });
  const due = new Date(Number(h.nextDue) * 1000);
  return {
    inHouse: true,
    house: h.name,
    today: new Date().toDateString(),
    rent: usd(h.rent),
    rentDay: due.toDateString(),
    daysUntilRent: Math.ceil((due.getTime() - Date.now()) / 86_400_000),
    potSoFar: usd(h.pot),
    potFull: h.pot >= h.rent,
    sharePerPerson: usd(share),
    housemates: addrs.map((a, i) => ({
      name: (extra[i * 2] as string) || "Unnamed",
      isYou: a.toLowerCase() === me.toLowerCase(),
      paidThisMonth: usd(paid[i]),
      stillOwesRent: usd(share > paid[i] ? share - paid[i] : 0n),
      sharedCostsBalance: usd(extra[i * 2 + 1] as bigint),
    })),
    note: "sharedCostsBalance: positive means the house owes them, negative means they owe.",
  };
}

async function recentActivity(me: Address, houseId: bigint | null, limit = 10, kind?: string) {
  if (!INDEXER) return { available: false, reason: "History isn't switched on yet." };
  const where = [`{ actor: { _eq: "${me.toLowerCase()}" } }`, `{ counterparty: { _eq: "${me.toLowerCase()}" } }`];
  if (houseId) where.push(`{ houseId: { _eq: "${houseId}" } }`);
  const kindFilter = kind && /^[a-z]+$/.test(kind) ? `, kind: { _eq: "${kind}" }` : "";
  const q = `{ Activity(where: { _or: [${where.join(",")}]${kindFilter} }, order_by: { timestamp: desc }, limit: ${Math.min(30, Math.max(1, limit))}) { kind actor counterparty amount memo corridor timestamp } Person(where: {}) { id name } }`;
  const res = await fetch(INDEXER, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: q }) });
  const json = (await res.json()) as { data?: { Activity: Record<string, string>[]; Person: { id: string; name: string | null }[] } };
  const names = new Map((json.data?.Person ?? []).map((p) => [p.id, p.name ?? "someone"]));
  const who = (a?: string) => (!a ? null : a === me.toLowerCase() ? "you" : names.get(a) ?? "someone outside the house");
  return (json.data?.Activity ?? []).map((a) => ({
    kind: a.kind,
    by: who(a.actor),
    with: who(a.counterparty),
    amount: usd(BigInt(a.amount ?? "0")),
    memo: a.memo,
    country: a.corridor,
    when: new Date(Number(a.timestamp) * 1000).toDateString(),
  }));
}

async function fxRate(currency: string) {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 600 } });
  const data = (await res.json()) as { rates: Record<string, number> };
  const code = currency.toUpperCase().slice(0, 3);
  return data.rates[code] ? { currency: code, perDollar: data.rates[code] } : { error: `No rate for ${code}` };
}

function system(name: string, memory: string[]) {
  return `You are the steward of a shared home in the Vesta app. You help ${name || "the person"} keep track of rent, shared costs and money they send to family.

How you talk:
- Warm, brief and plain, like a thoughtful housemate. One to three short sentences unless they ask for detail.
- Money in US dollars like $40.00. Say "rent pot", "shared costs", "send home". Never mention blockchains, wallets, tokens, gas or addresses.
- Use the tools for any fact about money. Never guess a number.
- You can't move money. When an action would help, call suggest_action so they get a button. For reminders to housemates, call draft_message.
- If you learn a lasting habit or preference, call remember. Never store passwords, codes or anything sensitive.
- If something isn't available yet, say so simply.

What you remember about them (from earlier chats, private to them):
${memory.length ? memory.map((m) => `- ${m}`).join("\n") : "- Nothing yet."}`;
}

export async function runSteward(input: { me: Address; name: string; houseId: bigint | null; memory: string[]; messages: ChatMessage[] }) {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new StewardOff();
  const cards: StewardCard[] = [];
  const msgs: ChatMessage[] = [{ role: "system", content: system(input.name, input.memory.slice(0, 30)) }, ...input.messages.slice(-12)];

  for (let round = 0; round < 6; round++) {
    const body: Record<string, unknown> = { model: MODEL, messages: msgs, tools, max_tokens: 900 };
    if (MODEL.startsWith("kimi-k3")) body.reasoning_effort = "low";
    else body.thinking = { type: "disabled" };
    const res = await fetch(KIMI_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Kimi ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices: { message: ChatMessage & { role: "assistant" }; finish_reason: string }[] };
    const choice = data.choices[0];
    // Keep the whole assistant message, reasoning included, so tool rounds stay coherent.
    msgs.push(choice.message);
    const calls = choice.message.tool_calls ?? [];
    if (choice.finish_reason !== "tool_calls" || calls.length === 0) {
      return { reply: (choice.message.content ?? "").trim(), cards };
    }
    for (const call of calls) {
      let result: unknown;
      try {
        const args = JSON.parse(call.function.arguments || "{}");
        switch (call.function.name) {
          case "get_house_status":
            result = await houseStatus(input.me, input.houseId);
            break;
          case "get_recent_activity":
            result = await recentActivity(input.me, input.houseId, args.limit, args.kind);
            break;
          case "get_balance": {
            const bal = await serverPublic.readContract({ address: addresses.ausd, abi: erc20Abi, functionName: "balanceOf", args: [input.me] });
            result = { dollars: usd(bal) };
            break;
          }
          case "get_exchange_rate":
            result = await fxRate(String(args.currency ?? ""));
            break;
          case "suggest_action":
            cards.push({ type: "action", action: args.action, amount: args.amount, to: args.to, label: String(args.label).slice(0, 60) });
            result = { shown: true };
            break;
          case "draft_message":
            cards.push({ type: "message", to: String(args.to), text: String(args.text).slice(0, 400) });
            result = { shown: true };
            break;
          case "remember":
            cards.push({ type: "remember", fact: String(args.fact).slice(0, 140) });
            result = { saved: true };
            break;
          default:
            result = { error: "Unknown tool" };
        }
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "Tool failed" };
      }
      msgs.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { reply: "Sorry, I got tangled up there. Could you ask that another way?", cards };
}

export class StewardOff extends Error {}

export function parseAddress(a: unknown): Address | null {
  return typeof a === "string" && isAddress(a) ? a : null;
}
