/**
 * Today "From your circle" — pure mapping from one visible followee diary row to
 * the card payload. Privacy / follow / adult filtering happens in the SQL query
 * (`today-circle-activity-query.ts`); this module never invents activity.
 */

import type { StaffRole } from "@still/auth/permissions";
import type { PlanTierId } from "@still/plans";

/** Scoped columns selected by the circle query (no whole-row `movie`/`tv`). */
export type TodayCircleRow = {
	logId: string;
	actorUserId: string;
	handle: string;
	displayName: string;
	/** `user.image` — web proxies it through the patron avatar route. */
	actorImage: string | null;
	/** Tenths 0–100. */
	rating: number | null;
	movieId: number | null;
	tvId: number | null;
	movieTitle: string | null;
	moviePosterPath: string | null;
	tvTitle: string | null;
	tvPosterPath: string | null;
	/** Linked review body when the viewer may see that review. */
	reviewBody: string | null;
	reviewContainsSpoilers: boolean | null;
};

export type TodayCircleActorBadge = {
	planTier: PlanTierId;
	staffRole: StaffRole | null;
};

export type TodayCirclePayload =
	| {
			kind: "activity";
			actor: {
				userId: string;
				handle: string;
				displayName: string;
				image: string | null;
			} & TodayCircleActorBadge;
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
	  }
	| { kind: "invite" };

const DEFAULT_EXCERPT_MAX_CHARS = 120;

/** `#[Label](/path)` / `@[Label](/path)` → `Label`. */
const MENTION_TOKEN = /[#@]\[([^\]]*)\]\([^)]*\)/g;
/** Common markdown markers — excerpt is plain text in a compact card. */
const MARKDOWN_MARKERS = /[*_`>#~]+/g;

/** Plain-text review preview for the circle card, cut on a word boundary. */
export function reviewExcerptPlainText(
	body: string,
	maxChars = DEFAULT_EXCERPT_MAX_CHARS,
): string | null {
	const plain = body
		.replace(MENTION_TOKEN, "$1")
		.replace(MARKDOWN_MARKERS, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!plain) return null;
	if (plain.length <= maxChars) return plain;

	const cut = plain.slice(0, maxChars);
	const lastSpace = cut.lastIndexOf(" ");
	const head = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
	return `${head.replace(/[,.;:!?-]+$/, "")}…`;
}

export function buildTodayCirclePayload(
	row: TodayCircleRow | null,
	badge: TodayCircleActorBadge | null,
): TodayCirclePayload {
	if (!row || !badge) return { kind: "invite" };

	const isMovie = row.movieId != null;
	const tmdbId = isMovie ? row.movieId : row.tvId;
	const name = isMovie ? row.movieTitle : row.tvTitle;
	// Title cache missing — showing a nameless tile would read as broken.
	if (tmdbId == null || !name) return { kind: "invite" };

	const excerpt =
		row.reviewBody && row.reviewContainsSpoilers === false
			? reviewExcerptPlainText(row.reviewBody)
			: null;

	return {
		kind: "activity",
		actor: {
			userId: row.actorUserId,
			handle: row.handle,
			displayName: row.displayName,
			image: row.actorImage,
			...badge,
		},
		title: {
			mediaKind: isMovie ? "movie" : "tv",
			tmdbId,
			name,
			posterPath: isMovie ? row.moviePosterPath : row.tvPosterPath,
		},
		ratingDisplay: row.rating != null ? row.rating / 10 : null,
		excerpt,
		logId: row.logId,
	};
}
