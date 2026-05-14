import type { Metadata } from "next";
import Link from "next/link";

import { DiaryEntry, type DiaryLogRow } from "@/components/diary/diary-entry";
import { Section } from "@/components/ui/section";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Diary" };
export const dynamic = "force-dynamic";

export default async function DiaryPage() {
  const api = await serverApi();
  const res = await api.api.logs.me.get().catch(() => ({ data: [] }));
  const items = (res.data as unknown as DiaryLogRow[]) ?? [];

  // Bucket logs by year/month for that classic Letterboxd diary feel.
  const grouped = items.reduce<Map<string, DiaryLogRow[]>>((acc, row) => {
    const date = new Date(row.log.watchedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const list = acc.get(key) ?? [];
    list.push(row);
    acc.set(key, list);
    return acc;
  }, new Map());

  return (
    <div className="space-y-10">
      <Section
        kicker="Ticket book"
        title="Your diary"
        subtitle="Every film, every viewing — one stub per showtime."
      >
        {items.length === 0 ? (
          <p className="cinema-film-strip-rail rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            No screenings logged yet — the booth is closed until you do. Open a{" "}
            <Link href="/search" className="text-foreground underline">
              film
            </Link>{" "}
            and tap <em>Log</em>.
          </p>
        ) : null}
        {Array.from(grouped.entries()).map(([key, rows]) => {
          const [year, month] = key.split("-");
          const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", {
            month: "long",
          });
          return (
            <div
              key={key}
              className="cinema-film-strip-rail cinema-film-strip-rail--coded space-y-3"
              data-edge-code={`KODAK · 5219 · ${monthLabel.slice(0, 3).toUpperCase()} ${year}`}
              data-edge-layout="vertical"
            >
              <h3 className="font-display text-xl tracking-[-0.01em] text-muted-foreground">
                {monthLabel} {year}
              </h3>
              {/* Ticket cards are taller — wider gutters + responsive columns keep the lobby-wall vibe. */}
              <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <li key={row.log.id}>
                    <DiaryEntry row={row} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Section>
    </div>
  );
}
