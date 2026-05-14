import type { Metadata } from "next";

import { ChatPane } from "@/components/chat/chat-pane";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

type Thread = {
  thread: {
    id: string;
    kind: "dm" | "group";
    title: string | null;
    lastMessageAt: string;
    lastMessagePreview: string | null;
  };
  members: {
    chatMember: { userId: string };
    user: { id: string; name: string; image: string | null } | null;
    profile: { handle: string; displayName: string } | null;
  }[];
};

export default async function ChatPage() {
  const api = await serverApi();
  const res = await api.api.chat.threads.get().catch(() => ({ data: [] }));
  const threads = (res.data as unknown as Thread[]) ?? [];
  return <ChatPane threads={threads} />;
}
