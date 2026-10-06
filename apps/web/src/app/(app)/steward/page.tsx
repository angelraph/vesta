"use client";

import { Sparkles } from "lucide-react";
import { Card, Empty, TopBar } from "@/components/ui";

export default function Steward() {
  return (
    <div>
      <TopBar title="Steward" back="/home" />
      <Card>
        <Empty icon={<Sparkles size={22} />} title="Your house steward">
          Ask who&apos;s paid, what&apos;s due and how much you sent home this month. Arriving shortly.
        </Empty>
      </Card>
    </div>
  );
}
