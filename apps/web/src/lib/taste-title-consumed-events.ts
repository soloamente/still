import {
	markTodayPickContinuityCompleted,
	type TodayPickCompletedVia,
} from "@/lib/today-pick-continuity";

/** Browser event — taste hero evicts titles after watchlist add or diary log. */
export const TASTE_TITLE_CONSUMED_EVENT = "still:taste-title-consumed";

export type TasteTitleConsumedDetail = {
	tmdbId: number;
	/** How it was consumed — lets a Today pick finished on detail restore as done. */
	via?: TodayPickCompletedVia;
};

/** Notify the home taste hero that a film is no longer a valid suggestion. */
export function dispatchTasteTitleConsumed(detail: TasteTitleConsumedDetail) {
	if (typeof window === "undefined") return;
	// Home may be unmounted (title page) — persist so it restores the pick as complete.
	if (detail.via) markTodayPickContinuityCompleted(detail.tmdbId, detail.via);
	window.dispatchEvent(
		new CustomEvent<TasteTitleConsumedDetail>(TASTE_TITLE_CONSUMED_EVENT, {
			detail,
		}),
	);
}
