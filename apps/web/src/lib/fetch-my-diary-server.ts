import "server-only";

import { serverApi } from "@/lib/server-api";
import type { DiaryResultRow, DiaryTabCounts } from "@/lib/still-api-fetch";

export type DiarySeed = {
	results: DiaryResultRow[];
	total_pages: number;
	total_results: number;
	tabCounts: DiaryTabCounts;
};

/** RSC seed for page 1 of `/diary`, forwarding the visitor's cookies via Eden. */
export async function fetchMyDiaryServer(opts: {
	media: "movie" | "tv";
	order: "latest" | "earliest" | "title";
	venue: "theaters" | "streaming" | null;
}): Promise<DiarySeed> {
	const empty: DiarySeed = {
		results: [],
		total_pages: 0,
		total_results: 0,
		tabCounts: { movies: 0, tv: 0 },
	};
	try {
		const client = await serverApi();
		const res = await client.api.logs.me.diary.get({
			query: {
				media: opts.media,
				order: opts.order,
				page: "1",
				...(opts.venue ? { venue: opts.venue } : {}),
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
		};
	} catch (err) {
		console.error("[fetchMyDiaryServer] threw:", err);
		return empty;
	}
}
