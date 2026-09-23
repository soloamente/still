import type { TitleRecommendationReasonCode } from "@still/db";

/**
 * Pure rules for patron-to-patron title recommendations (Today **Recommend back**).
 * DB reads live in `title-recommendation-query.ts`; the route wires both.
 */

export type RecommendationMediaKind = "movie" | "tv";

export const RECOMMENDATION_REASON_CODES = [
	"same_mood",
	"you_would_love",
	"hidden_gem",
	"watch_together",
	"because_you_liked",
] as const satisfies readonly TitleRecommendationReasonCode[];

/** Preview copy for the preset reasons (notification body + sheet chips). */
export const RECOMMENDATION_REASON_LABELS: Record<
	TitleRecommendationReasonCode,
	string
> = {
	same_mood: "Matches your mood",
	you_would_love: "You’d love this",
	hidden_gem: "Hidden gem",
	watch_together: "Let’s watch it together",
	because_you_liked: "Because of what you’ve liked",
};

export const RECOMMENDATION_NOTE_MAX = 280;
export const RECOMMENDATION_SUGGESTION_LIMIT = 3;

const REASON_CODE_SET = new Set<string>(RECOMMENDATION_REASON_CODES);

export function parseRecommendationReasonCode(
	raw: unknown,
): TitleRecommendationReasonCode | null {
	return typeof raw === "string" && REASON_CODE_SET.has(raw)
		? (raw as TitleRecommendationReasonCode)
		: null;
}

export function normalizeRecommendationNote(
	raw: string | null | undefined,
): { ok: true; note: string | null } | { ok: false } {
	const trimmed = raw?.trim() ?? "";
	if (trimmed.length === 0) return { ok: true, note: null };
	if (trimmed.length > RECOMMENDATION_NOTE_MAX) return { ok: false };
	return { ok: true, note: trimmed };
}

/** Film and show ids share TMDb's integer space — always key by kind + id. */
export function titleKey(mediaKind: RecommendationMediaKind, tmdbId: number) {
	return `${mediaKind}:${tmdbId}`;
}

export function recommendationHref(
	mediaKind: RecommendationMediaKind,
	tmdbId: number,
	recommendationId: string,
): string {
	const base = mediaKind === "movie" ? "/movies" : "/tv";
	return `${base}/${tmdbId}?recommend=${encodeURIComponent(recommendationId)}`;
}

export type RecommendationGate =
	| { ok: true }
	| { ok: false; reason: "self" | "not_connected" | "unavailable" };

/**
 * Recommend only within the follow graph (either direction — an answer may go
 * back to someone the patron doesn't follow). Blocks and bans read as
 * "unavailable" so the sender can't probe why.
 */
export function canRecommendBetween(args: {
	senderId: string;
	recipientId: string;
	senderFollowsRecipient: boolean;
	recipientFollowsSender: boolean;
	blocked: boolean;
	recipientBanned: boolean;
}): RecommendationGate {
	if (args.senderId === args.recipientId) return { ok: false, reason: "self" };
	if (args.blocked || args.recipientBanned) {
		return { ok: false, reason: "unavailable" };
	}
	if (!args.senderFollowsRecipient && !args.recipientFollowsSender) {
		return { ok: false, reason: "not_connected" };
	}
	return { ok: true };
}

/** One of the sender's own diary logs (already filtered by the sender's adult pref). */
export type RecommendationSuggestionCandidate = {
	mediaKind: RecommendationMediaKind;
	tmdbId: number;
	title: string;
	posterPath: string | null;
	/** Stored tenths 0–100; `null` for an unrated favorite. */
	ratingTenths: number | null;
	liked: boolean;
	loggedAt: Date;
	/** Adult / sensitive title — the sheet must confirm before sending. */
	sensitive: boolean;
};

export type RecommendationSuggestion = RecommendationSuggestionCandidate & {
	/** Only ever true when the recipient's matching log is visible to the sender. */
	alreadyWatchedVisible: boolean;
};

function compareCandidates(
	a: RecommendationSuggestionCandidate,
	b: RecommendationSuggestionCandidate,
): number {
	const byRating = (b.ratingTenths ?? -1) - (a.ratingTenths ?? -1);
	if (byRating !== 0) return byRating;
	if (a.liked !== b.liked) return a.liked ? -1 : 1;
	return b.loggedAt.getTime() - a.loggedAt.getTime();
}

/**
 * Three real picks from the sender's best-loved titles. Titles the recipient
 * has visibly watched stay eligible (flagged) but sink below fresh picks;
 * titles already recommended to this recipient are skipped.
 */
export function rankRecommendationSuggestions({
	candidates,
	recipientVisibleWatchedKeys,
	alreadyRecommendedKeys,
	limit = RECOMMENDATION_SUGGESTION_LIMIT,
}: {
	candidates: readonly RecommendationSuggestionCandidate[];
	recipientVisibleWatchedKeys: ReadonlySet<string>;
	alreadyRecommendedKeys: ReadonlySet<string>;
	limit?: number;
}): RecommendationSuggestion[] {
	const bestByTitle = new Map<string, RecommendationSuggestionCandidate>();
	for (const row of candidates) {
		const key = titleKey(row.mediaKind, row.tmdbId);
		if (alreadyRecommendedKeys.has(key)) continue;
		const current = bestByTitle.get(key);
		if (!current || compareCandidates(row, current) < 0) {
			bestByTitle.set(key, row);
		}
	}

	return [...bestByTitle.values()]
		.map((row) => ({
			...row,
			alreadyWatchedVisible: recipientVisibleWatchedKeys.has(
				titleKey(row.mediaKind, row.tmdbId),
			),
		}))
		.sort((a, b) => {
			if (a.alreadyWatchedVisible !== b.alreadyWatchedVisible) {
				return a.alreadyWatchedVisible ? 1 : -1;
			}
			return compareCandidates(a, b);
		})
		.slice(0, limit);
}

export type RecommendationNotificationInput = {
	recommendationId: string;
	senderUserId: string;
	senderName: string;
	mediaKind: RecommendationMediaKind;
	tmdbId: number;
	title: string;
	posterPath: string | null;
	reasonCode: TitleRecommendationReasonCode | null;
	note: string | null;
	sensitive: boolean;
};

/**
 * Inbox row for `recommendation.received`. Sensitive sends omit the title,
 * artwork and note from every preview field; the deep link still resolves.
 */
export function buildRecommendationNotification(
	input: RecommendationNotificationInput,
): {
	title: string;
	body: string | null;
	payload: Record<string, unknown>;
} {
	const sender = input.senderName.trim() || "Someone";
	const idField =
		input.mediaKind === "movie"
			? { movieId: input.tmdbId }
			: { tvId: input.tmdbId };
	const payload: Record<string, unknown> = {
		recommendationId: input.recommendationId,
		fromUserId: input.senderUserId,
		/** Sender name for **Recommend something back** — never sensitive. */
		fromName: sender,
		mediaKind: input.mediaKind,
		...idField,
		sensitive: input.sensitive,
		posterPath: input.sensitive ? null : input.posterPath,
		href: recommendationHref(
			input.mediaKind,
			input.tmdbId,
			input.recommendationId,
		),
	};

	if (input.sensitive) {
		return {
			title: `${sender} sent you a recommendation`,
			body: null,
			payload,
		};
	}

	const body = input.note
		? `“${input.note}”`
		: input.reasonCode
			? RECOMMENDATION_REASON_LABELS[input.reasonCode]
			: null;
	return {
		title: `${sender} thinks you’d like ${input.title}`,
		body,
		payload,
	};
}
