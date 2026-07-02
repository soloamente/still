import type { ShowcaseItem, ShowcaseTvLogScope, TvLogScope } from "@still/db";
import { db, log, movie, review, tv } from "@still/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

/** Patron-curated identity strip on profile hero (max 4 slots). */
export const MAX_SHOWCASE_ITEMS = 4;

export type ResolvedShowcaseTile = {
	kind: ShowcaseItem["kind"];
	id: number | string;
	title: string;
	posterPath: string | null;
	/** Review headline for `kind: review` — title or trimmed body excerpt. */
	reviewHeadline: string | null;
	/** TV-only — diary scope label for scoped showcase slots. */
	tvScopeLabel: string | null;
	logScope: ShowcaseTvLogScope | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
};

type ShowcaseTvItem = Extract<ShowcaseItem, { kind: "tv" }>;

/** Stable dedup key — TV slots include diary scope (whole show · season · episode). */
export function showcaseItemKey(item: ShowcaseItem): string {
	if (item.kind === "review") return `review:${item.id}`;
	if (item.kind === "movie") return `movie:${item.id}`;
	const scope = item.logScope ?? "show";
	if (scope === "show") return `tv:${item.id}:show`;
	if (scope === "season")
		return `tv:${item.id}:season:${item.seasonNumber ?? ""}`;
	return `tv:${item.id}:episode:${item.seasonNumber ?? ""}:${item.episodeNumber ?? ""}`;
}

function normalizeShowcaseTvItem(item: ShowcaseTvItem): ShowcaseTvItem {
	const logScope = item.logScope ?? "show";
	if (logScope === "show") {
		return { kind: "tv", id: item.id, logScope: "show" };
	}
	if (logScope === "season") {
		if (
			typeof item.seasonNumber !== "number" ||
			!Number.isFinite(item.seasonNumber)
		) {
			throw new Error("invalid season number");
		}
		return {
			kind: "tv",
			id: item.id,
			logScope: "season",
			seasonNumber: item.seasonNumber,
		};
	}
	if (
		typeof item.seasonNumber !== "number" ||
		!Number.isFinite(item.seasonNumber)
	) {
		throw new Error("invalid season number");
	}
	if (
		typeof item.episodeNumber !== "number" ||
		!Number.isFinite(item.episodeNumber)
	) {
		throw new Error("invalid episode number");
	}
	return {
		kind: "tv",
		id: item.id,
		logScope: "episode",
		seasonNumber: item.seasonNumber,
		episodeNumber: item.episodeNumber,
	};
}

function parseShowcaseTvScope(raw: unknown): ShowcaseTvLogScope | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (raw === "show" || raw === "season" || raw === "episode") return raw;
	throw new Error("invalid tv log scope");
}

function tvScopeLabel(
	logScope: ShowcaseTvLogScope,
	seasonNumber: number | null,
	episodeNumber: number | null,
): string | null {
	if (logScope === "show") return null;
	if (logScope === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	if (logScope === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
	}
	return null;
}

/** Parse and validate raw showcase json from PATCH body or DB. */
export function parseShowcaseItems(raw: unknown): ShowcaseItem[] {
	if (!Array.isArray(raw)) {
		throw new Error("showcase must be an array");
	}
	if (raw.length > MAX_SHOWCASE_ITEMS) {
		throw new Error("showcase max 4 items");
	}

	const seen = new Set<string>();
	const out: ShowcaseItem[] = [];

	for (const entry of raw) {
		if (!entry || typeof entry !== "object") {
			throw new Error("invalid showcase item");
		}
		const row = entry as Record<string, unknown>;
		const kind = row.kind;
		const id = row.id;

		if (kind === "movie") {
			if (typeof id !== "number" || !Number.isFinite(id)) {
				throw new Error("invalid listing id");
			}
			const item: ShowcaseItem = { kind: "movie", id };
			const key = showcaseItemKey(item);
			if (seen.has(key)) throw new Error("duplicate showcase item");
			seen.add(key);
			out.push(item);
			continue;
		}

		if (kind === "tv") {
			if (typeof id !== "number" || !Number.isFinite(id)) {
				throw new Error("invalid listing id");
			}
			const logScope = parseShowcaseTvScope(row.logScope);
			const item = normalizeShowcaseTvItem({
				kind: "tv",
				id,
				logScope,
				seasonNumber:
					typeof row.seasonNumber === "number" ? row.seasonNumber : undefined,
				episodeNumber:
					typeof row.episodeNumber === "number" ? row.episodeNumber : undefined,
			});
			const key = showcaseItemKey(item);
			if (seen.has(key)) throw new Error("duplicate showcase item");
			seen.add(key);
			out.push(item);
			continue;
		}

		if (kind === "review") {
			if (typeof id !== "string" || id.trim().length < 4) {
				throw new Error("invalid review id");
			}
			const item: ShowcaseItem = { kind: "review", id };
			const key = showcaseItemKey(item);
			if (seen.has(key)) throw new Error("duplicate showcase item");
			seen.add(key);
			out.push(item);
			continue;
		}

		throw new Error("invalid showcase kind");
	}

	return out;
}

/** Alias used by PATCH handler after syntactic validation. */
export function validateShowcasePatch(items: ShowcaseItem[]): ShowcaseItem[] {
	return parseShowcaseItems(items);
}

/**
 * When `showcase_items` is empty, fall back to legacy onboarding favorites
 * so existing patrons see films on the hero without re-saving.
 */
export function migrateLegacyFavoriteMovies(
	showcaseItems: ShowcaseItem[],
	favoriteMovieIds: number[],
): ShowcaseItem[] {
	if (showcaseItems.length > 0) return showcaseItems;
	return favoriteMovieIds
		.filter((id) => Number.isFinite(id))
		.slice(0, MAX_SHOWCASE_ITEMS)
		.map((id) => ({ kind: "movie" as const, id }));
}

function reviewHeadlineFromRow(row: {
	title: string | null;
	body: string;
}): string {
	const title = row.title?.trim();
	if (title) return title;
	const body = row.body.trim();
	if (!body) return "";
	return body.length <= 120 ? body : `${body.slice(0, 117)}…`;
}

function logRowMatchesShowcaseTvItem(
	row: {
		logScope: TvLogScope;
		seasonNumber: number | null;
		episodeNumber: number | null;
	},
	item: ShowcaseTvItem,
): boolean {
	const scope = item.logScope ?? "show";
	if (scope === "show") return row.logScope === "show";
	if (scope === "season") {
		return row.logScope === "season" && row.seasonNumber === item.seasonNumber;
	}
	return (
		row.logScope === "episode" &&
		row.seasonNumber === item.seasonNumber &&
		row.episodeNumber === item.episodeNumber
	);
}

async function patronHasDiaryForShowcaseItem(
	userId: string,
	item: ShowcaseItem,
): Promise<boolean> {
	if (item.kind === "review") return true;

	if (item.kind === "movie") {
		const [row] = await db
			.select({ id: log.id })
			.from(log)
			.where(
				and(
					eq(log.userId, userId),
					isNull(log.removedAt),
					eq(log.movieId, item.id),
					isNotNull(log.movieId),
				),
			)
			.limit(1);
		return Boolean(row);
	}

	const rows = await db
		.select({
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			episodeNumber: log.episodeNumber,
		})
		.from(log)
		.where(
			and(
				eq(log.userId, userId),
				isNull(log.removedAt),
				eq(log.tvId, item.id),
				isNotNull(log.tvId),
			),
		);

	return rows.some((row) => logRowMatchesShowcaseTvItem(row, item));
}

/**
 * Ensure showcase items reference real cached listings, owned public reviews,
 * and diary logs the patron has actually watched.
 */
export async function validateShowcaseItemsForUser(
	userId: string,
	rawItems: unknown,
): Promise<
	| { ok: true; items: ShowcaseItem[] }
	| { ok: false; status: 400; error: string }
> {
	let items: ShowcaseItem[];
	try {
		items = parseShowcaseItems(rawItems);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Invalid showcase";
		return { ok: false, status: 400, error: message };
	}

	if (items.length === 0) return { ok: true, items: [] };

	const movieIds = items
		.filter((item) => item.kind === "movie")
		.map((item) => item.id);
	const tvIds = [
		...new Set(
			items.filter((item) => item.kind === "tv").map((item) => item.id),
		),
	];
	const reviewIds = items
		.filter((item) => item.kind === "review")
		.map((item) => item.id);

	if (movieIds.length > 0) {
		const rows = await db
			.select({ id: movie.tmdbId })
			.from(movie)
			.where(inArray(movie.tmdbId, movieIds));
		if (rows.length !== movieIds.length) {
			return { ok: false, status: 400, error: "Unknown film in showcase" };
		}
	}

	if (tvIds.length > 0) {
		const rows = await db
			.select({ id: tv.tmdbId })
			.from(tv)
			.where(inArray(tv.tmdbId, tvIds));
		if (rows.length !== tvIds.length) {
			return { ok: false, status: 400, error: "Unknown show in showcase" };
		}
	}

	if (reviewIds.length > 0) {
		const rows = await db
			.select({ id: review.id })
			.from(review)
			.where(
				and(
					eq(review.userId, userId),
					eq(review.visibility, "public"),
					isNull(review.removedAt),
					inArray(review.id, reviewIds),
				),
			);
		if (rows.length !== reviewIds.length) {
			return {
				ok: false,
				status: 400,
				error: "Showcase reviews must be your own public reviews",
			};
		}
	}

	for (const item of items) {
		if (item.kind === "review") continue;
		const hasDiary = await patronHasDiaryForShowcaseItem(userId, item);
		if (!hasDiary) {
			return {
				ok: false,
				status: 400,
				error: "Showcase films and shows must be in your diary",
			};
		}
	}

	return { ok: true, items };
}

/** Hydrate showcase slots for profile hero — preserves patron order; drops stale rows. */
export async function hydrateShowcaseTiles(
	rawItems: unknown,
	favoriteMovieIds: number[],
): Promise<ResolvedShowcaseTile[]> {
	const items = migrateLegacyFavoriteMovies(
		Array.isArray(rawItems) ? (rawItems as ShowcaseItem[]) : [],
		favoriteMovieIds,
	);
	if (items.length === 0) return [];

	const movieIds = items
		.filter((item) => item.kind === "movie")
		.map((item) => item.id);
	const tvIds = items
		.filter((item) => item.kind === "tv")
		.map((item) => item.id);
	const reviewIds = items
		.filter((item) => item.kind === "review")
		.map((item) => item.id);

	const [movieRows, tvRows, reviewRows] = await Promise.all([
		movieIds.length > 0
			? db
					.select({
						id: movie.tmdbId,
						title: movie.title,
						posterPath: movie.posterPath,
					})
					.from(movie)
					.where(inArray(movie.tmdbId, movieIds))
			: Promise.resolve([]),
		tvIds.length > 0
			? db
					.select({
						id: tv.tmdbId,
						title: tv.title,
						posterPath: tv.posterPath,
					})
					.from(tv)
					.where(inArray(tv.tmdbId, tvIds))
			: Promise.resolve([]),
		reviewIds.length > 0
			? db
					.select({
						id: review.id,
						title: review.title,
						body: review.body,
						movieTitle: movie.title,
						posterPath: movie.posterPath,
					})
					.from(review)
					.leftJoin(movie, eq(review.movieId, movie.tmdbId))
					.where(
						and(
							eq(review.visibility, "public"),
							isNull(review.removedAt),
							inArray(review.id, reviewIds),
						),
					)
			: Promise.resolve([]),
	]);

	const movieById = new Map(movieRows.map((row) => [row.id, row]));
	const tvById = new Map(tvRows.map((row) => [row.id, row]));
	const reviewById = new Map(reviewRows.map((row) => [row.id, row]));

	const tiles: ResolvedShowcaseTile[] = [];

	for (const item of items) {
		if (item.kind === "movie") {
			const row = movieById.get(item.id);
			if (!row) continue;
			tiles.push({
				kind: "movie",
				id: row.id,
				title: row.title,
				posterPath: row.posterPath,
				reviewHeadline: null,
				tvScopeLabel: null,
				logScope: null,
				seasonNumber: null,
				episodeNumber: null,
			});
			continue;
		}

		if (item.kind === "tv") {
			const row = tvById.get(item.id);
			if (!row) continue;
			const logScope = item.logScope ?? "show";
			const seasonNumber =
				logScope === "show" ? null : (item.seasonNumber ?? null);
			const episodeNumber =
				logScope === "episode" ? (item.episodeNumber ?? null) : null;
			tiles.push({
				kind: "tv",
				id: row.id,
				title: row.title,
				posterPath: row.posterPath,
				reviewHeadline: null,
				tvScopeLabel: tvScopeLabel(logScope, seasonNumber, episodeNumber),
				logScope,
				seasonNumber,
				episodeNumber,
			});
			continue;
		}

		const row = reviewById.get(item.id);
		if (!row) continue;
		tiles.push({
			kind: "review",
			id: row.id,
			title: row.movieTitle ?? "Review",
			posterPath: row.posterPath,
			reviewHeadline: reviewHeadlineFromRow(row) || null,
			tvScopeLabel: null,
			logScope: null,
			seasonNumber: null,
			episodeNumber: null,
		});
	}

	return tiles;
}
