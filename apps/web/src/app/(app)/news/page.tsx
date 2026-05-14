import type { Metadata } from "next";

import { NewsStrip } from "@/components/news/news-strip";
import { Section } from "@/components/ui/section";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "News" };
export const dynamic = "force-dynamic";

type NewsArticle = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  movieIds: number[];
};
type NewsSource = { id: string; name: string; kind: string };

export default async function NewsPage() {
  const api = await serverApi();
  const res = await api.api.news.get().catch(() => ({ data: [] }));
  const items =
    (res.data as unknown as { article: NewsArticle; source: NewsSource | null }[] | null) ?? [];

  return (
    <div className="space-y-10">
      <Section
        title="News"
        subtitle="The trades, the festivals, and what's coming out of the rooms."
      >
        <NewsStrip items={items} />
      </Section>
    </div>
  );
}
