"use client";

import { useSession } from "@/lib/hooks";
import { useHome, useNames } from "@/lib/house";
import { useActivity } from "@/lib/activity";
import { ActivityList } from "@/components/ActivityList";
import { Card, TopBar } from "@/components/ui";

export default function ActivityPage() {
  const s = useSession();
  const { view, houseIds } = useHome(s);
  const activity = useActivity(s?.address, houseIds, 100);
  const names = useNames(s, view?.members);
  if (!s) return null;
  return (
    <div>
      <TopBar title="Activity" back="/home" />
      <Card pad={false} className="px-4 py-2">
        <ActivityList items={activity.data ?? null} me={s.address} names={names} unavailable={!process.env.NEXT_PUBLIC_INDEXER_URL} />
      </Card>
    </div>
  );
}
