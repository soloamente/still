import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@still/ui/components/button";
import { Section } from "@/components/ui/section";
import { ListCard } from "@/components/list/list-card";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Lists" };
export const dynamic = "force-dynamic";

type ListRow = {
  id: string;
  title: string;
  description: string | null;
  itemsCount: number;
  coverMovieIds: number[];
  updatedAt: string;
  isPublic: boolean;
};

export default async function ListsPage() {
  const api = await serverApi();
  const [mineRes, popularRes] = await Promise.all([
    api.api.lists.me.get().catch(() => ({ data: [] })),
    api.api.lists.popular.get().catch(() => ({ data: [] })),
  ]);
  const mine = (mineRes.data as unknown as ListRow[]) ?? [];
  const popular = (popularRes.data as unknown as ListRow[]) ?? [];

  return (
    <div className="space-y-12">
      <Section
        title="Your lists"
        rightSlot={
          <Link href="/lists/new">
            <Button variant="accent" size="pill">
              New list
            </Button>
          </Link>
        }
      >
        {mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Lists are how you organize films — your watchlist for noir, your annual top 10, your
            personal canon. Make one to begin.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mine.map((row) => (
              <ListCard key={row.id} list={row} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Popular this week">
        {popular.length === 0 ? (
          <p className="text-sm text-muted-foreground">No popular lists yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {popular.map((row) => (
              <ListCard key={row.id} list={row} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
