import "server-only";

import type { DiaryWatchPeriods } from "@/lib/diary-lobby-order";
import { serverApi } from "@/lib/server-api";
import type { DiaryResultRow, DiaryTabCounts } from "@/lib/still-api-fetch";

export type DiarySeed = {
	results: DiaryResultRow[];
	total_pages: number;
	total_results: number;
	tabCounts: DiaryTabCounts;
	watchPeriods: DiaryWatchPeriods;
};

/** RSC seed for page 1 of `/diary`, forwarding the visitor's cookies via Eden. */
export async function fetchMyDiaryServer(opts: {
	media: "movie" | "tv";
	order: "latest" | "earliest" | "title";
	venue: "theaters" | "streaming" | null;
	year?: number | null;
	decade?: number | null;
}): Promise<DiarySeed> {
	const empty: DiarySeed = {
		results: [],
		total_pages: 0,
		total_results: 0,
		tabCounts: { movies: 0, tv: 0 },
		watchPeriods: { years: [], decades: [] },
	};
	try {
		const client = await serverApi();
		const res = await client.api.logs.me.diary.get({
			query: {
				media: opts.media,
				order: opts.order,
				page: "1",
				...(opts.venue ? { venue: opts.venue } : {}),
				...(opts.year != null ? { year: String(opts.year) } : {}),
				...(opts.decade != null ? { decade: String(opts.decade) } : {}),
			},
		});
		if (res.error != null) {
			console.error("[fetchMyDiaryServer] failed:", res.error);
			return empty;
		}
		const data = res.data as unknown as Partial<DiarySeed> | null;
		if (!data || !Array.isArray(data.results)) return empty;
		return {
			results: data.results,
			total_pages: typeof data.total_pages === "number" ? data.total_pages : 0,
			total_results:
				typeof data.total_results === "number" ? data.total_results : 0,
			tabCounts: data.tabCounts ?? { movies: 0, tv: 0 },
			watchPeriods: data.watchPeriods ?? { years: [], decades: [] },
		};
	} catch (err) {
		console.error("[fetchMyDiaryServer] threw:", err);
		return empty;
	}
}
