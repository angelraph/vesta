"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Globe2, Users } from "lucide-react";
import { useSession } from "@/lib/hooks";
import { Card, IconBubble, Notice, SectionTitle, TopBar } from "@/components/ui";

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
        <SectionTitle>From crypto you already hold</SectionTitle>
        <Card className="flex items-start gap-3">
          <IconBubble tone="ember">
            <Globe2 size={18} />
          </IconBubble>
          <div>
            <p className="font-semibold">USDC, USDT or SOL from 30+ networks</p>
            <p className="mt-0.5 text-[13.5px] text-ink-2">One address that takes money from wherever you hold it and lands it in your house. Switching on shortly.</p>
          </div>
        </Card>
      </div>

      <Notice>
        <span className="flex items-start gap-2">
          <Users size={16} className="mt-0.5 shrink-0" />
          New to Vesta? Your first few dollars to try it out are on us, sent when you create your account.
        </span>
      </Notice>
    </div>
  );
}
