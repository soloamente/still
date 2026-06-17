"use client";

import { useCallback, useEffect, useState } from "react";

import type { ListingEngagementCounts } from "@/components/movie/movie-detail-engagement-chips";
import { fetchListingEngagementSummary } from "@/lib/fetch-listing-engagement";
import {
	LISTING_ENGAGEMENT_INVALIDATE_EVENT,
	type ListingEngagementInvalidateDetail,
} from "@/lib/listing-engagement-invalidate";

function normalizeEngagementCounts(
	counts: Partial<ListingEngagementCounts> | undefined,
): ListingEngagementCounts {
	return {
		watchesCount: Math.max(0, Math.floor(counts?.watchesCount ?? 0)),
		listsCount: Math.max(0, Math.floor(counts?.listsCount ?? 0)),
		favoritesCount: Math.max(0, Math.floor(counts?.favoritesCount ?? 0)),
		watchlistCount: Math.max(0, Math.floor(counts?.watchlistCount ?? 0)),
	};
}

/**
 * Live engagement chip totals — seeds from RSC, refetches on invalidation events
 * after diary / watchlist / favorite mutations on the same listing.
 */
export function useListingEngagementCounts(input: {
	listingKind: "movie" | "tv";
	listingId: number;
	initial: Partial<ListingEngagementCounts> | undefined;
}) {
	const [counts, setCounts] = useState(() =>
		normalizeEngagementCounts(input.initial),
	);

	useEffect(() => {
		setCounts(normalizeEngagementCounts(input.initial));
	}, [
		input.initial?.watchesCount,
		input.initial?.listsCount,
		input.initial?.favoritesCount,
		input.initial?.watchlistCount,
	]);

	const refresh = useCallback(async () => {
		const summary = await fetchListingEngagementSummary({
			listingKind: input.listingKind,
			listingId: input.listingId,
		});
		if (summary) setCounts(normalizeEngagementCounts(summary));
	}, [input.listingKind, input.listingId]);

	useEffect(() => {
		const handleInvalidate = (event: Event) => {
			const detail = (event as CustomEvent<ListingEngagementInvalidateDetail>)
				.detail;
			if (
				detail.listingKind !== input.listingKind ||
				detail.listingId !== input.listingId
			) {
				return;
			}
			void refresh();
		};

		window.addEventListener(
			LISTING_ENGAGEMENT_INVALIDATE_EVENT,
			handleInvalidate,
		);
		return () => {
			window.removeEventListener(
				LISTING_ENGAGEMENT_INVALIDATE_EVENT,
				handleInvalidate,
			);
		};
	}, [input.listingKind, input.listingId, refresh]);

	return counts;
}
