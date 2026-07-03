import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import { stillApiOrigin } from "@/lib/still-api-origin";

export const PROFILE_REVIEWS_PAGE_SIZE = 20;

function normalizePublishedAt(value: unknown): string {
	if (typeof value === "string") return value;
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	return new Date().toISOString();
}

/** Map API `{ review, movie }` rows into profile review tiles. */
export function normalizeProfileReviewRow(
	raw: unknown,
): ProfileReviewRow | null {
	if (!raw || typeof raw !== "object") return null;
	const row = raw as {
		review?: Record<string, unknown>;
		movie?: Record<string, unknown> | null;
	};
	const review = row.review;
	if (!review || typeof review.id !== "string") return null;

	const movie =
		row.movie &&
		typeof row.movie.tmdbId === "number" &&
		typeof row.movie.title === "string"
			? {
					tmdbId: row.movie.tmdbId,
					title: row.movie.title,
					posterPath:
						typeof row.movie.posterPath === "string"
							? row.movie.posterPath
							: null,
				}
			: null;

	return {
		review: {
			id: review.id,
			userId: typeof review.userId === "string" ? review.userId : "",
			movieId:
				typeof review.movieId === "number"
					? review.movieId
					: (movie?.tmdbId ?? 0),
			title: typeof review.title === "string" ? review.title : null,
			body: typeof review.body === "string" ? review.body : "",
			rating: typeof review.rating === "number" ? review.rating : null,
			likesCount: typeof review.likesCount === "number" ? review.likesCount : 0,
			commentsCount:
				typeof review.commentsCount === "number" ? review.commentsCount : 0,
			publishedAt: normalizePublishedAt(review.publishedAt),
			containsSpoilers:
				typeof review.containsSpoilers === "boolean"
					? review.containsSpoilers
					: false,
			visibility:
				review.visibility === "public" ||
				review.visibility === "followers" ||
				review.visibility === "friends" ||
				review.visibility === "private"
					? review.visibility
					: undefined,
			audioUrl: typeof review.audioUrl === "string" ? review.audioUrl : null,
			audioDurationMs:
				typeof review.audioDurationMs === "number"
					? review.audioDurationMs
					: null,
		},
		movie,
	};
}

function buildProfileReviewsUrl(
	handle: string,
	page: number,
	limit = PROFILE_REVIEWS_PAGE_SIZE,
): URL {
	const url = new URL(
		`/api/profiles/${encodeURIComponent(handle)}/reviews`,
		stillApiOrigin(),
	);
	url.searchParams.set("page", String(Math.max(1, Math.floor(page)) || 1));
	url.searchParams.set("limit", String(limit));
	return url;
}

/** Client page fetch for the profile reviews grid. */
export async function fetchProfileReviews(
	handle: string,
	page: number,
	opts?: { signal?: AbortSignal; limit?: number },
): Promise<
	| {
			results: ProfileReviewRow[];
			total_pages: number;
			total_results: number;
	  }
	| { error: true }
> {
	const url = buildProfileReviewsUrl(handle, page, opts?.limit);
	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal: opts?.signal,
	});
	if (!response.ok) return { error: true };
	const raw = (await response.json().catch(() => null)) as {
		results?: unknown[];
		total_pages?: number;
		total_results?: number;
	} | null;
	if (!raw || !Array.isArray(raw.results)) return { error: true };
	const results = raw.results
		.map(normalizeProfileReviewRow)
		.filter((row): row is ProfileReviewRow => row != null);
	return {
		results,
		total_pages: typeof raw.total_pages === "number" ? raw.total_pages : page,
		total_results:
			typeof raw.total_results === "number"
				? raw.total_results
				: results.length,
	};
}
