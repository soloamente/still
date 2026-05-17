import type { Metadata } from "next";
import Link from "next/link";
import type { DiaryLogRow } from "@/components/diary/diary-entry";
import {
	DiaryPageClient,
	type DiarySection,
} from "@/components/diary/diary-page-client";
import { Section } from "@/components/ui/section";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Diary" };
export const dynamic = "force-dynamic";

function monthBucketKey(watchedAt: string): string {
	const date = new Date(watchedAt);
	if (Number.isNaN(date.getTime())) return "undated";
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DiaryPage() {
	const api = await serverApi();
	const res = await api.api.logs.me.get().catch(() => ({ data: [] }));
	const raw = (res.data as unknown as DiaryLogRow[]) ?? [];
	/** Rows without a joined movie cannot render a stub — drop them before grouping. */
	const items = raw.filter((row) => row.movie != null);

	const grouped = items.reduce<Map<string, DiaryLogRow[]>>((acc, row) => {
		const key = monthBucketKey(row.log.watchedAt);
		const list = acc.get(key) ?? [];
		list.push(row);
		acc.set(key, list);
		return acc;
	}, new Map());

	// Newest months first; within each month, newest screening first (Letterboxd diary order).
	const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
		if (a === "undated") return 1;
		if (b === "undated") return -1;
		return b.localeCompare(a);
	});

	const sections: DiarySection[] = sortedKeys.map((key) => {
		const rows = (grouped.get(key) ?? []).slice().sort((a, b) => {
			const ta = new Date(a.log.watchedAt).getTime();
			const tb = new Date(b.log.watchedAt).getTime();
			return tb - ta;
		});
		if (key === "undated") {
			return { key, monthLabel: "Undated", year: "", rows };
		}
		const [year, month] = key.split("-");
		const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString(
			"en-US",
			{
				month: "long",
			},
		);
		return { key, monthLabel, year, rows };
	});

	const hasRows = items.length > 0;

	return (
		<div className="space-y-10">
			<Section
				kicker="Ticket book"
				title="Your diary"
				subtitle="Every film, every viewing — one stub per showtime."
			>
				{!hasRows ? (
					<p className="cinema-film-strip-rail rounded-2xl border border-border border-dashed bg-surface-raised/40 p-10 text-center text-muted-foreground text-sm">
						No screenings logged yet — the booth is closed until you do. Open a{" "}
						<Link href="/search" className="text-foreground underline">
							film
						</Link>{" "}
						and tap <em>Log</em>.
					</p>
				) : (
					<DiaryPageClient sections={sections} />
				)}
			</Section>
		</div>
	);
}
