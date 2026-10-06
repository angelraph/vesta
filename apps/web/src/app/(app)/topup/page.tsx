"use client";

import { useSession } from "@/lib/hooks";
import { Card, Header } from "@/components/ui";

export default function TopUp() {
  const s = useSession();
  if (!s) return null;
  return (
    <div className="space-y-5">
      <Header title="Top up" back="/home" />
      <Card className="space-y-2">
        <p className="text-sm text-muted">Your Vesta address</p>
        <p className="num break-all">{s.address}</p>
        <p className="text-sm text-muted">Anyone on Vesta can send to this address.</p>
      </Card>
    </div>
  );
}
