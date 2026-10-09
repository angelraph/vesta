"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Sparkles } from "lucide-react";
import { useSession } from "@/lib/hooks";
import { Card, IconBubble, SectionTitle, TopBar } from "@/components/ui";
import { TEST_CAP, TEST_GRANT, TestMoneyButton } from "@/components/TestMoney";

export default function TopUp() {
  const s = useSession();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!s) return;
    QRCode.toDataURL(s.address, { margin: 1, width: 440, color: { dark: "#0f1f1a", light: "#ffffff" } }).then(setQr);
  }, [s]);

  if (!s) return null;

  return (
    <div className="space-y-6">
      <TopBar title="Add money" back="/home" />

      <div>
        <SectionTitle>From someone on Vesta</SectionTitle>
        <Card className="flex flex-col items-center text-center">
          <div className="rounded-3xl bg-white p-3 shadow-[0_0_0_1px_var(--line)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            {qr ? <img src={qr} alt="Your Vesta address as a QR code" className="size-48" /> : <div className="skeleton size-48" />}
          </div>
          <p className="mt-4 text-[14px] text-ink-2">Housemates and family can scan this, or you can send the address.</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(s.address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="num mt-3 flex items-center gap-2 rounded-full bg-sunken px-4 py-2 text-[13px] font-semibold"
          >
            {copied ? <Check size={15} className="text-good" /> : <Copy size={15} />}
            {s.address.slice(0, 10)}…{s.address.slice(-8)}
          </button>
        </Card>
      </div>

      <div>
        <SectionTitle>Test money</SectionTitle>
        <Card className="space-y-3">
          <div className="flex items-start gap-3">
            <IconBubble tone="ember">
              <Sparkles size={18} />
            </IconBubble>
            <div>
              <p className="font-semibold">Try everything for free</p>
              <p className="mt-0.5 text-[13.5px] text-ink-2">
                Vesta runs on a test network. Add ${TEST_GRANT} of test money any time you have less than ${TEST_CAP}. It isn&apos;t real money.
              </p>
            </div>
          </div>
          <TestMoneyButton s={s} />
        </Card>
      </div>
    </div>
  );
}
