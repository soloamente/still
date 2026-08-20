import "server-only";

import { cookies } from "next/headers";

import { normalizeQuoteSubmissionsPage } from "@/lib/normalize-quote-submissions-page";
import type { QuoteSubmissionsPage } from "@/lib/quote-submission-types";
import {
	QUOTES_LOBBY_PAGE_SIZE,
	type QuotesLobbyKind,
	type QuotesSubmissionStatusFilter,
} from "@/lib/quotes-lobby";
import { fetchMyQuoteSubmissions } from "@/lib/still-api-fetch";

/** RSC seed for `/quotes?view=submitted` — signed-in patron submission history. */
export async function fetchMyQuoteSubmissionsServer(opts: {
	kind: QuotesLobbyKind;
	status: QuotesSubmissionStatusFilter;
	page?: number;
	limit?: number;
}): Promise<QuoteSubmissionsPage> {
	const empty: QuoteSubmissionsPage = {
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
		const res = await fetchMyQuoteSubmissions(
			{
				page: opts.page ?? 1,
				limit: opts.limit ?? QUOTES_LOBBY_PAGE_SIZE,
				...(opts.kind !== "all" ? { kind: opts.kind } : {}),
				...(opts.status !== "all" ? { status: opts.status } : {}),
			},
			{ cookieHeader: cookieHeader || undefined },
		);
		if (res.error != null) {
			console.error("[fetchMyQuoteSubmissionsServer] failed:", res.error);
			return empty;
		}
		return normalizeQuoteSubmissionsPage(res.data);
	} catch (err) {
		console.error("[fetchMyQuoteSubmissionsServer] threw:", err);
		return empty;
	}
}
