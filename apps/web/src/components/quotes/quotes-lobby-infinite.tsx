"use client";

import { useCallback } from "react";

import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { QuotesSavedRow } from "@/components/quotes/quotes-saved-row";
import { normalizeSavedQuotesPage } from "@/lib/normalize-saved-quotes-page";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import {
	QUOTES_LOBBY_PAGE_SIZE,
	type QuotesLobbyKind,
} from "@/lib/quotes-lobby";
import { QUOTES_SAVED_LOBBY_GRID_CLASSNAME } from "@/lib/quotes-lobby-layout";
import { fetchMySavedQuotes } from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function QuotesLobbyInfinite({
	seeds,
	initialHasMore,
	kind,
}: {
	seeds: SavedQuoteLobbyItem[];
	initialHasMore: boolean;
	kind: QuotesLobbyKind;
}) {
	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const res = await fetchMySavedQuotes(
				{
					page,
					limit: QUOTES_LOBBY_PAGE_SIZE,
					...(kind !== "all" ? { kind } : {}),
				},
				{ signal },
			);
			if (res.error) return { error: true as const };
			const data = normalizeSavedQuotesPage(res.data);
			return {
				items: data.items,
				nextCursor: data.hasMore ? page + 1 : null,
			};
		},
		[kind],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		SavedQuoteLobbyItem,
		number
	>({
		seeds,
		initialCursor: initialHasMore ? 2 : null,
		loadMore,
		getKey: (item) => item.saveId,
	});

	return (
		<>
			<ul className={QUOTES_SAVED_LOBBY_GRID_CLASSNAME}>
				{items.map((item) => (
					<li key={item.saveId} className="min-w-0">
						<QuotesSavedRow item={item} />
					</li>
				))}
			</ul>
			<CommunityInfiniteFooter
				footerState={footerState}
				sentinelRef={sentinelRef}
				retry={retry}
				loadingLabel="Loading more quotes"
			/>
		</>
	);
}
