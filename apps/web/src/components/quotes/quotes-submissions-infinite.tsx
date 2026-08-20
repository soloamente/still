"use client";

import { useCallback } from "react";

import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { QuotesSubmissionRow } from "@/components/quotes/quotes-submission-row";
import { normalizeQuoteSubmissionsPage } from "@/lib/normalize-quote-submissions-page";
import type { QuoteSubmissionLobbyItem } from "@/lib/quote-submission-types";
import {
	QUOTES_LOBBY_PAGE_SIZE,
	type QuotesLobbyKind,
	type QuotesSubmissionStatusFilter,
} from "@/lib/quotes-lobby";
import { fetchMyQuoteSubmissions } from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function QuotesSubmissionsInfinite({
	seeds,
	initialHasMore,
	kind,
	status,
}: {
	seeds: QuoteSubmissionLobbyItem[];
	initialHasMore: boolean;
	kind: QuotesLobbyKind;
	status: QuotesSubmissionStatusFilter;
}) {
	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const res = await fetchMyQuoteSubmissions(
				{
					page,
					limit: QUOTES_LOBBY_PAGE_SIZE,
					...(kind !== "all" ? { kind } : {}),
					...(status !== "all" ? { status } : {}),
				},
				{ signal },
			);
			if (res.error) return { error: true as const };
			const data = normalizeQuoteSubmissionsPage(res.data);
			return {
				items: data.items,
				nextCursor: data.hasMore ? page + 1 : null,
			};
		},
		[kind, status],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		QuoteSubmissionLobbyItem,
		number
	>({
		seeds,
		initialCursor: initialHasMore ? 2 : null,
		loadMore,
		getKey: (item) => item.submissionId,
	});

	return (
		<>
			<ul className="mx-auto flex w-full max-w-2xl flex-col gap-5">
				{items.map((item) => (
					<li key={item.submissionId}>
						<QuotesSubmissionRow item={item} />
					</li>
				))}
			</ul>
			<CommunityInfiniteFooter
				footerState={footerState}
				sentinelRef={sentinelRef}
				retry={retry}
				loadingLabel="Loading more submissions"
			/>
		</>
	);
}
