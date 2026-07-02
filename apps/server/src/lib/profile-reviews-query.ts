import { db, movie, profile, review } from "@still/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { communityOffset, parseCommunityPage } from "./community-page-args";
import { contentVisibilityWhere } from "./content-visibility";

/** Default page size for profile **Reviews** tab grids. */
export const PROFILE_REVIEWS_PAGE_SIZE = 20;

export type ProfileReviewApiRow = {
	review: typeof review.$inferSelect;
	movie: typeof movie.$inferSelect | null;
};

export function parseProfileReviewsPage(raw: string | undefined): number {
	return parseCommunityPage(raw);
}

export function parseProfileReviewsLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return PROFILE_REVIEWS_PAGE_SIZE;
	return Math.min(Math.floor(n), 50);
}

export function profileReviewsTotalPages(total: number, limit: number): number {
	if (total <= 0) return 0;
	return Math.max(1, Math.ceil(total / limit));
}

/** Visible published reviews for a patron profile — viewer-scoped visibility. */
export async function fetchProfileReviewsPage(opts: {
	userId: string;
	viewerId: string | null;
	page: number;
	limit: number;
}): Promise<{
	results: ProfileReviewApiRow[];
	total: number;
	totalPages: number;
}> {
	const offset = communityOffset(opts.page, opts.limit);
	const visibilityWhere = and(
		eq(review.userId, opts.userId),
		isNull(review.removedAt),
		contentVisibilityWhere(opts.viewerId, review.userId, review.visibility),
	);

	const [totalRow] = await db
		.select({ total: count() })
		.from(review)
		.where(visibilityWhere);

	const total = Number(totalRow?.total ?? 0);
	if (total === 0) {
		return { results: [], total: 0, totalPages: 0 };
	}

	const results = await db
		.select({ review, movie })
		.from(review)
		.leftJoin(movie, eq(review.movieId, movie.tmdbId))
		.where(visibilityWhere)
		.orderBy(desc(review.publishedAt))
		.limit(opts.limit)
		.offset(offset);

	return {
		results,
		total,
		totalPages: profileReviewsTotalPages(total, opts.limit),
	};
}

/** Cheap count for profile tab chrome — does not hydrate review bodies. */
export async function fetchProfileReviewsCount(
	userId: string,
	viewerId: string | null,
): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(review)
		.where(
			and(
				eq(review.userId, userId),
				isNull(review.removedAt),
				contentVisibilityWhere(viewerId, review.userId, review.visibility),
			),
		);
	return Number(row?.total ?? 0);
}

/** Resolve patron by handle for reviews routes — 404 when private to viewer. */
export async function resolveProfileReviewsAccess(
	handle: string,
	viewerId: string | null,
): Promise<
	{ ok: true; userId: string } | { ok: false; status: 404; error: string }
> {
	const normalized = handle.toLowerCase();
	const [row] = await db
		.select({ userId: profile.userId, isPrivate: profile.isPrivate })
		.from(profile)
		.where(eq(profile.handle, normalized))
		.limit(1);
	if (!row) return { ok: false, status: 404, error: "Not found" };
	const isOwner = viewerId === row.userId;
	if (row.isPrivate && !isOwner) {
		return { ok: false, status: 404, error: "Not found" };
	}
	return { ok: true, userId: row.userId };
}
