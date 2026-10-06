import { createPublicClient, decodeEventLog, http, isHash, hexToString } from "viem";
import { houseVaultAbi } from "@/lib/abi/houseVault";
import { addresses, AUSD_DECIMALS, chain, explorerTx } from "@/lib/config";
import { Mark } from "@/components/Logo";

const client = createPublicClient({ chain, transport: http(process.env.MONAD_RPC_URL) });

const symbols: Record<string, string> = { NGN: "₦", GHS: "GH₵", KES: "KSh", ZAR: "R", GBP: "£", EUR: "€" };

export default async function Receipt({ params }: PageProps<"/r/[hash]">) {
  const { hash } = await params;
  let sent: { from: string; to: string; amount: number; corridor: string; fx: number; memo: string; name: string } | null = null;
  let when: Date | null = null;

  if (isHash(hash)) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== addresses.houseVault.toLowerCase()) continue;
        try {
          const ev = decodeEventLog({ abi: houseVaultAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "SentHome") {
            const name = await client.readContract({
              address: addresses.houseVault,
              abi: houseVaultAbi,
              functionName: "displayName",
              args: [ev.args.from],
            });
            sent = {
              from: ev.args.from,
              to: ev.args.to,
              amount: Number(ev.args.amount) / 10 ** AUSD_DECIMALS,
              corridor: hexToString(ev.args.corridor).replace(/\0/g, ""),
              fx: Number(ev.args.fxRate) / 1e6,
              memo: ev.args.memo,
              name: name || "Someone",
            };
          }
        } catch {}
      }
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      when = new Date(Number(block.timestamp) * 1000);
    } catch {}
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Mark size={48} />
      {sent ? (
        <>
          <p className="mt-8 text-sm font-medium uppercase tracking-wide text-ember">Money received</p>
          <h1 className="mt-2 font-display text-[34px] font-semibold leading-tight">
            {sent.name} sent you ${sent.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </h1>
          {sent.fx > 0 && symbols[sent.corridor] ? (
            <p className="num mt-2 text-lg text-muted">
              about {symbols[sent.corridor]}
              {(sent.amount * sent.fx).toLocaleString("en-GB", { maximumFractionDigits: 0 })} at the rate on the day
            </p>
          ) : null}
          {sent.memo ? <p className="mt-6 rounded-2xl bg-paper p-4 text-lg">&ldquo;{sent.memo}&rdquo;</p> : null}
          <dl className="mt-6 space-y-2 text-sm">
            {when ? (
              <div className="flex justify-between">
                <dt className="text-muted">Arrived</dt>
                <dd>{when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">To</dt>
              <dd className="num truncate">{sent.to}</dd>
            </div>
          </dl>
          <a href={explorerTx(hash)} className="mt-6 text-sm text-hearth underline" target="_blank" rel="noreferrer">
            Independent record of this payment
          </a>
          <a href="/" className="mt-10 rounded-2xl bg-hearth px-5 py-3.5 text-center font-semibold text-cream">
            Open your own Vesta
          </a>
        </>
      ) : (
        <>
          <h1 className="mt-8 font-display text-3xl font-semibold">We couldn&apos;t find that receipt</h1>
          <p className="mt-2 text-muted">It may still be arriving. Refresh in a moment.</p>
        </>
      )}
    </main>
  );
}
