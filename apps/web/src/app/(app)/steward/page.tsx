"use client";

import { Card, Header } from "@/components/ui";

export default function Steward() {
  return (
    <div className="space-y-5">
      <Header title="Steward" />
      <Card>
        <p className="text-muted">Your house steward is on its way.</p>
      </Card>
    </div>
  );
}
