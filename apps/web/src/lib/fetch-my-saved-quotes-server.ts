import "server-only";

import { cookies } from "next/headers";

import type { ContentVisibility } from "@/components/review/visibility-select";

import { normalizeSavedQuotesPage } from "@/lib/normalize-saved-quotes-page";
import type { SavedQuotesPage } from "@/lib/quote-saved-types";
import {
	QUOTES_LOBBY_PAGE_SIZE,
	type QuotesLobbyKind,
} from "@/lib/quotes-lobby";
import { fetchMySavedQuotes } from "@/lib/still-api-fetch";

/** RSC seed for `/quotes` — signed-in patron saved collection. */
export async function fetchMySavedQuotesServer(opts: {
	kind: QuotesLobbyKind;
	page?: number;
	limit?: number;
	visibility?: ContentVisibility;
}): Promise<SavedQuotesPage> {
	const empty: SavedQuotesPage = {
		items: [],
		page: 1,
		limit: opts.limit ?? QUOTES_LOBBY_PAGE_SIZE,
		hasMore: false,
	};
	try {
		const store = await cookies();
		const cookieHeader = store
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join("; ");
		const res = await fetchMySavedQuotes(
			{
				page: opts.page ?? 1,
				limit: opts.limit ?? QUOTES_LOBBY_PAGE_SIZE,
				...(opts.kind !== "all" ? { kind: opts.kind } : {}),
				...(opts.visibility ? { visibility: opts.visibility } : {}),
			},
			{ cookieHeader: cookieHeader || undefined },
		);
		if (res.error != null) {
			console.error("[fetchMySavedQuotesServer] failed:", res.error);
			return empty;
		}
		return normalizeSavedQuotesPage(res.data);
	} catch (err) {
		console.error("[fetchMySavedQuotesServer] threw:", err);
		return empty;
	}
}
