/** Browser event — detail pages refetch engagement chip totals after diary/watchlist mutations. */
export const LISTING_ENGAGEMENT_INVALIDATE_EVENT =
	"still:listing-engagement-invalidate";

export type ListingEngagementInvalidateDetail = {
	listingKind: "movie" | "tv";
	listingId: number;
};

/** Notify engagement chips on the same title to refetch summary counts. */
export function dispatchListingEngagementInvalidate(
	detail: ListingEngagementInvalidateDetail,
) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<ListingEngagementInvalidateDetail>(
			LISTING_ENGAGEMENT_INVALIDATE_EVENT,
			{ detail },
		),
	);
}
