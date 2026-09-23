import type { PlanTierId } from "@still/plans";

import { formatLogRatingDisplay } from "@/lib/log-rating";
import type { StaffRole } from "@/lib/staff-role-labels";

/** Mirrors server `TodayCirclePayload` (`GET /api/today/circle`). Pure — no env / fetch. */
export type TodayCircleActivity = {
	kind: "activity";
	actor: {
		userId: string;
		handle: string;
		displayName: string;
		image: string | null;
		planTier: PlanTierId;
		staffRole: StaffRole | null;
	};
	title: {
		mediaKind: "movie" | "tv";
		tmdbId: number;
		name: string;
		posterPath: string | null;
	};
	/** Display scale 0–10. */
	ratingDisplay: number | null;
	excerpt: string | null;
	logId: string;
};

export type TodayCirclePayload = TodayCircleActivity | { kind: "invite" };

export function todayCircleTitleHref(
	title: TodayCircleActivity["title"],
): `/movies/${number}` | `/tv/${number}` {
	return title.mediaKind === "movie"
		? `/movies/${title.tmdbId}`
		: `/tv/${title.tmdbId}`;
}

/** Short verb line under the byline — score when the followee rated it. */
export function todayCircleActionLabel(activity: TodayCircleActivity): string {
	return activity.ratingDisplay != null
		? `Rated it ${formatLogRatingDisplay(activity.ratingDisplay)}`
		: "Watched it";
}
