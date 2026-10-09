import Link from "next/link";
import { createPublicClient, decodeEventLog, http, isHash, hexToString } from "viem";
import { houseVaultAbi } from "@/lib/abi/houseVault";
import { addresses, AUSD_DECIMALS, chain, explorerTx } from "@/lib/config";
import { Wordmark } from "@/components/Logo";

const client = createPublicClient({ chain, transport: http(process.env.MONAD_RPC_URL) });

const places: Record<string, { flag: string; symbol: string; name: string }> = {
  NGN: { flag: "🇳🇬", symbol: "₦", name: "Nigeria" },
  GHS: { flag: "🇬🇭", symbol: "GH₵", name: "Ghana" },
  KES: { flag: "🇰🇪", symbol: "KSh", name: "Kenya" },
  ZAR: { flag: "🇿🇦", symbol: "R", name: "South Africa" },
  GBP: { flag: "🇬🇧", symbol: "£", name: "United Kingdom" },
  EUR: { flag: "🇪🇺", symbol: "€", name: "Europe" },
};

export const metadata = { title: "Vesta receipt" };

export default async function Receipt({ params }: PageProps<"/r/[hash]">) {
  const { hash } = await params;
  let sent: { from: string; to: string; amount: number; corridor: string; fx: number; memo: string; name: string } | null = null;
  let when: Date | null = null;
  let settled = false;

  if (isHash(hash)) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== addresses.houseVault.toLowerCase()) continue;
        try {
          const ev = decodeEventLog({ abi: houseVaultAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "SettledHome") settled = true;
          if (ev.eventName === "SentHome") {
            const name = await client.readContract({ address: addresses.houseVault, abi: houseVaultAbi, functionName: "displayName", args: [ev.args.from] });
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

  const place = sent ? places[sent.corridor] : undefined;
  const usd = (n: number) => `$${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-8">
      <div className="flex items-center gap-2">
        <Wordmark size={22} />
      </div>

      {sent ? (
        <>
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="pop flex size-[76px] items-center justify-center rounded-full bg-good text-white">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path className="draw" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <p className="mt-5 text-[15px] text-ink-2">{sent.name} sent you</p>
            <p className="num mt-1 text-[44px] font-extrabold leading-none tracking-tight">{usd(sent.amount)}</p>
            {sent.fx > 0 && place ? (
              <p className="num mt-2 text-[17px] font-semibold text-good">
                {place.symbol}
                {(sent.amount * sent.fx).toLocaleString("en-GB", { maximumFractionDigits: 0 })} at the day&apos;s rate
              </p>
            ) : null}
          </div>

          {sent.memo ? <p className="mt-8 rounded-[24px] bg-surface px-5 py-4 text-center text-[17px] font-medium">&ldquo;{sent.memo}&rdquo;</p> : null}

          <section className="mt-6 space-y-3.5 rounded-[24px] bg-surface p-5 text-[15px] shadow-[0_0_0_1px_rgba(15,31,26,0.04)]">
            <Line label="Status" value={<span className="text-good">Arrived</span>} />
            {settled ? <Line label="Settled by" value="Agora, instantly" /> : null}
            {when ? <Line label="When" value={when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} /> : null}
            {place ? <Line label="To" value={`${place.flag} ${place.name}`} /> : null}
            <Line label="Amount" value={usd(sent.amount)} />
            <Line label="Fee" value="$0.00" />
            {sent.fx > 0 && place ? <Line label="Rate" value={`$1 = ${place.symbol}${sent.fx.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`} /> : null}
            <div className="h-px bg-line" />
            <Line label="Reference" value={<span className="num text-[13px]">{hash.slice(0, 10)}…{hash.slice(-6)}</span>} />
          </section>

          <a href={explorerTx(hash)} target="_blank" rel="noreferrer" className="mt-4 text-center text-[13px] font-semibold text-hearth">
            Check this payment independently
          </a>

          <div className="mt-auto pt-10">
            <Link href="/" className="flex h-14 items-center justify-center rounded-2xl bg-hearth font-semibold text-white">
              Get Vesta, it&apos;s free
            </Link>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-[26px] font-extrabold">We can&apos;t find that receipt yet</h1>
          <p className="mt-2 text-ink-2">It may still be arriving. Refresh in a moment.</p>
        </div>
      )}
    </main>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-ink-2">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
