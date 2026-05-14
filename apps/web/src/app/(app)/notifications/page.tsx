import type { Metadata } from "next";

import { NotificationsList } from "@/components/notifications/notifications-list";
import { Section } from "@/components/ui/section";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export default async function NotificationsPage() {
  const api = await serverApi();
  const res = await api.api.notifications.get().catch(() => ({ data: [] }));
  const items = (res.data as unknown as NotificationRow[]) ?? [];
  return (
    <Section
      title="Notifications"
      subtitle="Replies, likes, new followers, and badges you've earned."
    >
      <NotificationsList items={items} />
    </Section>
  );
}
