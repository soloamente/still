import "server-only";

import { normalizeSavedQuotesPage } from "@/lib/normalize-saved-quotes-page";
import type { SavedQuotesPage } from "@/lib/quote-saved-types";
import { serverApi } from "@/lib/server-api";

/** Profile strip preview — pinned saves only; owner sees all visibilities. */
export async function fetchProfilePinnedQuotesPreview(args: {
	handle: string;
	limit?: number;
}): Promise<SavedQuotesPage> {
	const limit = args.limit ?? 3;
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
		console.error("[fetchProfilePinnedQuotesPreview] threw:", err);
		return empty;
	}
}
