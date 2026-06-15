import "server-only";

import { fetchMySavedQuotesServer } from "@/lib/fetch-my-saved-quotes-server";
import { normalizeSavedQuotesPage } from "@/lib/normalize-saved-quotes-page";
import type { SavedQuotesPage } from "@/lib/quote-saved-types";
import { serverApi } from "@/lib/server-api";

/** Profile strip preview — owner sees all visibilities; visitors public only. */
export async function fetchProfileSavedQuotesPreview(args: {
	handle: string;
	isOwner: boolean;
	limit?: number;
}): Promise<SavedQuotesPage> {
	const limit = args.limit ?? 3;
	if (args.isOwner) {
		return fetchMySavedQuotesServer({ kind: "all", page: 1, limit });
	}

	const empty: SavedQuotesPage = {
		items: [],
		page: 1,
		limit,
		hasMore: false,
	};
	try {
		const client = await serverApi();
		const res = await client.api.profiles({ handle: args.handle }).quotes.get({
			query: { page: "1", limit: String(limit) },
		});
		if (res.error != null) return empty;
		return normalizeSavedQuotesPage(res.data);
	} catch (err) {
		console.error("[fetchProfileSavedQuotesPreview] threw:", err);
		return empty;
	}
}
