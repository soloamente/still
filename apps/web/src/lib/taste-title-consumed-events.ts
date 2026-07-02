/** Browser event — taste hero evicts titles after watchlist add or diary log. */
export const TASTE_TITLE_CONSUMED_EVENT = "still:taste-title-consumed";

export type TasteTitleConsumedDetail = {
	tmdbId: number;
};

/** Notify the home taste hero that a film is no longer a valid suggestion. */
export function dispatchTasteTitleConsumed(detail: TasteTitleConsumedDetail) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<TasteTitleConsumedDetail>(TASTE_TITLE_CONSUMED_EVENT, {
			detail,
		}),
	);
}
