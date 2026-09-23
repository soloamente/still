import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

/**
 * Client rules for patron-to-patron recommendations (Today **Recommend back**,
 * inbox **Recommend something back**). Server truth: `apps/server/src/lib/title-recommendation.ts`.
 */

export type RecommendMediaKind = "movie" | "tv";

export type RecommendReasonCode =
	| "same_mood"
	| "you_would_love"
	| "hidden_gem"
	| "watch_together"
	| "because_you_liked";

/** Mirrors the server note cap (`RECOMMENDATION_NOTE_MAX`). */
export const RECOMMEND_NOTE_MAX = 280;

/**
 * Optional preset reasons in the confirm step. **Because you liked…** is left out
 * until the sheet can name a real shared title (spec: only when a connection exists).
 */
export const RECOMMEND_REASON_OPTIONS: ReadonlyArray<{
	id: RecommendReasonCode;
	label: string;
}> = [
	{ id: "you_would_love", label: "You’d love this" },
	{ id: "hidden_gem", label: "Hidden gem" },
	{ id: "same_mood", label: "Matches your mood" },
	{ id: "watch_together", label: "Watch together" },
];

/** Who the sheet sends to — preselected from the circle card or an inbox row. */
export type RecommendTarget = {
	recipientUserId: string;
	recipientName: string;
	/** Set when replying from a `recommendation.received` notification. */
	answerToRecommendationId?: string;
};

/** Row from `GET /api/recommendations/suggest`. */
export type RecommendSuggestion = {
	mediaKind: RecommendMediaKind;
	tmdbId: number;
	title: string;
	posterPath: string | null;
	ratingTenths: number | null;
	liked: boolean;
	sensitive: boolean;
	alreadyWatchedVisible: boolean;
};

/** A title picked in the sheet — from suggestions or search. */
export type RecommendPick = {
	mediaKind: RecommendMediaKind;
	tmdbId: number;
	title: string;
	/** Full poster URL (search) or TMDb path (suggestions) — resolved by the poster helper. */
	posterPathOrUrl: string | null;
	sensitive: boolean;
};

export type RecommendationNotificationTarget = {
	recommendationId: string;
	fromUserId: string;
	fromName: string;
	mediaKind: RecommendMediaKind;
	tmdbId: number;
};

function nonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

/** `recommendation.received` payload → ids the inbox actions need, or `null` when malformed. */
export function parseRecommendationNotificationPayload(
	payload: Record<string, unknown>,
): RecommendationNotificationTarget | null {
	const recommendationId = nonEmptyString(payload.recommendationId);
	const fromUserId = nonEmptyString(payload.fromUserId);
	const mediaKind =
		payload.mediaKind === "movie" || payload.mediaKind === "tv"
			? payload.mediaKind
			: null;
	const rawId = mediaKind === "movie" ? payload.movieId : payload.tvId;
	const tmdbId =
		typeof rawId === "number" && Number.isInteger(rawId) && rawId > 0
			? rawId
			: null;
	if (!recommendationId || !fromUserId || !mediaKind || tmdbId == null) {
		return null;
	}
	const handle = nonEmptyString(payload.fromHandle);
	const fromName =
		nonEmptyString(payload.fromName) ?? (handle ? `@${handle}` : "them");
	return { recommendationId, fromUserId, fromName, mediaKind, tmdbId };
}

/** `{ code }` from a JSON error body (Elysia `status(4xx, { code })`). */
export function sendRecommendationErrorCode(raw: unknown): string | null {
	if (raw == null || typeof raw !== "object") return null;
	const code = (raw as { code?: unknown }).code;
	return typeof code === "string" ? code : null;
}

/** Inline sheet error for a failed send (never a toast — feedback stays by the button). */
export function recommendSendErrorMessage(
	code: string | null,
	status: number,
	recipientName: string,
): string {
	switch (code) {
		case "already_recommended":
			return `You’ve already sent this to ${recipientName}.`;
		case "not_connected":
			return "You can only recommend to people you follow or who follow you.";
		case "unavailable":
			return `You can’t send recommendations to ${recipientName} right now.`;
		case "note_too_long":
			return `Keep the note under ${RECOMMEND_NOTE_MAX} characters.`;
		case "title_not_found":
			return "That title isn’t available right now.";
		default:
			break;
	}
	if (status === 429) {
		return "You’re sending a lot right now — try again in a bit.";
	}
	return "Couldn’t send that. Try again.";
}

/** Suggestion subtitle — kind + the sender's own score (or Favorite). */
export function recommendSuggestionMeta(s: {
	mediaKind: RecommendMediaKind;
	ratingTenths: number | null;
	liked: boolean;
}): string {
	const kind = s.mediaKind === "movie" ? "Film" : "Show";
	const score = formatStoredLogRatingDisplay(s.ratingTenths);
	if (score) return `${kind} · You rated ${score}`;
	if (s.liked) return `${kind} · Favorite`;
	return kind;
}
