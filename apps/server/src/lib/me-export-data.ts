import {
	comment,
	db,
	list,
	listItem,
	log,
	movie,
	profile,
	reaction,
	review,
	tv,
	tvWatch,
	user,
	watchlistItem,
} from "@still/db";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import {
	buildCsv,
	type CsvValue,
	displayTenToLetterboxdStars,
	exportDateKey,
	formatRatingTenDisplay,
	storedRatingToDisplayTen,
} from "./me-export-csv";

// ---------------------------------------------------------------------------
// Input shape — a plain data bag so `assembleExportFiles` stays pure/testable.
// ---------------------------------------------------------------------------

interface TitleRef {
	title: string;
	year: number | null;
	tmdbId: number;
}

export interface ExportInput {
	profile: {
		handle: string;
		displayName: string;
		bio: string | null;
		pronouns: string | null;
		location: string | null;
		website: string | null;
		joinedAt: Date | string;
		email: string;
	};
	favoriteFilms: TitleRef[];
	filmLogs: Array<
		TitleRef & {
			watchedAt: Date | string;
			createdAt: Date | string;
			rating: number | null;
			rewatch: boolean;
			liked: boolean;
			note: string | null;
		}
	>;
	tvLogs: Array<
		TitleRef & {
			watchedAt: Date | string;
			createdAt: Date | string;
			rating: number | null;
			rewatch: boolean;
			liked: boolean;
			note: string | null;
			logScope: string;
			seasonNumber: number | null;
			episodeNumber: number | null;
		}
	>;
	filmWatchlist: Array<TitleRef & { addedAt: Date | string }>;
	tvWatchlist: Array<TitleRef & { addedAt: Date | string }>;
	tvProgress: Array<
		TitleRef & {
			status: string;
			lastSeason: number | null;
			lastEpisode: number | null;
			startedAt: Date | string;
			statusChangedAt: Date | string;
		}
	>;
	reviews: Array<
		TitleRef & {
			reviewTitle: string | null;
			body: string;
			rating: number | null;
			containsSpoilers: boolean;
			publishedAt: Date | string;
			watchedAt: Date | string | null;
		}
	>;
	lists: Array<{
		title: string;
		description: string | null;
		isRanked: boolean;
		items: Array<{
			position: number;
			title: string;
			year: number | null;
			tmdbId: number;
			mediaType: "film" | "tv";
			note: string | null;
			addedAt: Date | string;
		}>;
	}>;
	comments: Array<{
		parentType: string;
		parentId: string;
		body: string;
		createdAt: Date | string;
	}>;
	likedReviews: Array<{
		reviewId: string;
		movieTitle: string | null;
		likedAt: Date | string;
	}>;
	likedLists: Array<{
		listId: string;
		listTitle: string | null;
		likedAt: Date | string;
	}>;
}

export interface ExportFile {
	path: string;
	contents: string;
}

// ---------------------------------------------------------------------------
// Pure assembly
// ---------------------------------------------------------------------------

function ratingColumns(stored: number | null): [CsvValue, CsvValue] {
	if (stored == null) return ["", ""];
	const displayTen = storedRatingToDisplayTen(stored);
	return [
		displayTenToLetterboxdStars(displayTen),
		formatRatingTenDisplay(displayTen),
	];
}

/** `lists/<slug>.csv` filename — ascii-safe, deduped with `-2`, `-3`, ... */
function listSlug(title: string, used: Set<string>): string {
	const base =
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "list";
	let slug = base;
	let n = 2;
	while (used.has(slug)) {
		slug = `${base}-${n}`;
		n += 1;
	}
	used.add(slug);
	return slug;
}

export function assembleExportFiles(input: ExportInput): ExportFile[] {
	const files: ExportFile[] = [];

	files.push({
		path: "profile.csv",
		contents: buildCsv(
			[
				"Date Joined",
				"Username",
				"Display Name",
				"Email Address",
				"Location",
				"Website",
				"Bio",
				"Pronoun",
				"Favorite Films",
			],
			[
				[
					exportDateKey(input.profile.joinedAt),
					input.profile.handle,
					input.profile.displayName,
					input.profile.email,
					input.profile.location,
					input.profile.website,
					input.profile.bio,
					input.profile.pronouns,
					input.favoriteFilms.map((f) => f.title).join(", "),
				],
			],
		),
	});

	files.push({
		path: "diary.csv",
		contents: buildCsv(
			[
				"Date",
				"Name",
				"Year",
				"TMDb ID",
				"Rating",
				"Rating10",
				"Rewatch",
				"Watched Date",
				"Note",
			],
			input.filmLogs.map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.createdAt),
					row.title,
					row.year,
					row.tmdbId,
					stars,
					ten,
					row.rewatch,
					exportDateKey(row.watchedAt),
					row.note,
				];
			}),
		),
	});

	// watched.csv — one row per distinct film (first watch date).
	const watchedByFilm = new Map<number, (typeof input.filmLogs)[number]>();
	for (const row of input.filmLogs) {
		const existing = watchedByFilm.get(row.tmdbId);
		if (
			!existing ||
			new Date(row.watchedAt).getTime() < new Date(existing.watchedAt).getTime()
		) {
			watchedByFilm.set(row.tmdbId, row);
		}
	}
	files.push({
		path: "watched.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			[...watchedByFilm.values()].map((row) => [
				exportDateKey(row.watchedAt),
				row.title,
				row.year,
				row.tmdbId,
			]),
		),
	});

	// ratings.csv — latest rated log per film.
	const latestRatedByFilm = new Map<number, (typeof input.filmLogs)[number]>();
	for (const row of input.filmLogs) {
		if (row.rating == null) continue;
		const existing = latestRatedByFilm.get(row.tmdbId);
		if (
			!existing ||
			new Date(row.watchedAt).getTime() >=
				new Date(existing.watchedAt).getTime()
		) {
			latestRatedByFilm.set(row.tmdbId, row);
		}
	}
	files.push({
		path: "ratings.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID", "Rating", "Rating10"],
			[...latestRatedByFilm.values()].map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.watchedAt),
					row.title,
					row.year,
					row.tmdbId,
					stars,
					ten,
				];
			}),
		),
	});

	files.push({
		path: "watchlist.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			input.filmWatchlist.map((row) => [
				exportDateKey(row.addedAt),
				row.title,
				row.year,
				row.tmdbId,
			]),
		),
	});

	files.push({
		path: "reviews.csv",
		contents: buildCsv(
			[
				"Date",
				"Name",
				"Year",
				"TMDb ID",
				"Review Title",
				"Review",
				"Rating",
				"Rating10",
				"Contains Spoilers",
				"Watched Date",
			],
			input.reviews.map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.publishedAt),
					row.title,
					row.year,
					row.tmdbId,
					row.reviewTitle,
					row.body,
					stars,
					ten,
					row.containsSpoilers,
					exportDateKey(row.watchedAt),
				];
			}),
		),
	});

	files.push({
		path: "tv-diary.csv",
		contents: buildCsv(
			[
				"Date",
				"Name",
				"Year",
				"TMDb ID",
				"Scope",
				"Season",
				"Episode",
				"Rating",
				"Rating10",
				"Rewatch",
				"Watched Date",
				"Note",
			],
			input.tvLogs.map((row) => {
				const [stars, ten] = ratingColumns(row.rating);
				return [
					exportDateKey(row.createdAt),
					row.title,
					row.year,
					row.tmdbId,
					row.logScope,
					row.seasonNumber,
					row.episodeNumber,
					stars,
					ten,
					row.rewatch,
					exportDateKey(row.watchedAt),
					row.note,
				];
			}),
		),
	});

	files.push({
		path: "tv-watchlist.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			input.tvWatchlist.map((row) => [
				exportDateKey(row.addedAt),
				row.title,
				row.year,
				row.tmdbId,
			]),
		),
	});

	files.push({
		path: "tv-progress.csv",
		contents: buildCsv(
			[
				"Name",
				"Year",
				"TMDb ID",
				"Status",
				"Last Season",
				"Last Episode",
				"Started",
				"Status Changed",
			],
			input.tvProgress.map((row) => [
				row.title,
				row.year,
				row.tmdbId,
				row.status,
				row.lastSeason,
				row.lastEpisode,
				exportDateKey(row.startedAt),
				exportDateKey(row.statusChangedAt),
			]),
		),
	});

	const usedSlugs = new Set<string>();
	for (const owned of input.lists) {
		files.push({
			path: `lists/${listSlug(owned.title, usedSlugs)}.csv`,
			contents: buildCsv(
				["Position", "Name", "Year", "TMDb ID", "Type", "Note", "Added"],
				owned.items.map((item) => [
					owned.isRanked ? item.position + 1 : "",
					item.title,
					item.year,
					item.tmdbId,
					item.mediaType,
					item.note,
					exportDateKey(item.addedAt),
				]),
			),
		});
	}

	files.push({
		path: "comments.csv",
		contents: buildCsv(
			["Date", "On", "Target Id", "Comment"],
			input.comments.map((row) => [
				exportDateKey(row.createdAt),
				row.parentType,
				row.parentId,
				row.body,
			]),
		),
	});

	// One row per liked film — keep the earliest watch when multiple logs hearted it.
	const likedFilmByTmdbId = new Map<number, (typeof input.filmLogs)[number]>();
	for (const row of input.filmLogs) {
		if (!row.liked) continue;
		const existing = likedFilmByTmdbId.get(row.tmdbId);
		if (
			!existing ||
			new Date(row.watchedAt).getTime() < new Date(existing.watchedAt).getTime()
		) {
			likedFilmByTmdbId.set(row.tmdbId, row);
		}
	}
	files.push({
		path: "likes/films.csv",
		contents: buildCsv(
			["Date", "Name", "Year", "TMDb ID"],
			[...likedFilmByTmdbId.values()].map((row) => [
				exportDateKey(row.watchedAt),
				row.title,
				row.year,
				row.tmdbId,
			]),
		),
	});

	files.push({
		path: "likes/reviews.csv",
		contents: buildCsv(
			["Date", "Review Id", "Film"],
			input.likedReviews.map((row) => [
				exportDateKey(row.likedAt),
				row.reviewId,
				row.movieTitle,
			]),
		),
	});

	files.push({
		path: "likes/lists.csv",
		contents: buildCsv(
			["Date", "List Id", "List"],
			input.likedLists.map((row) => [
				exportDateKey(row.likedAt),
				row.listId,
				row.listTitle,
			]),
		),
	});

	return files;
}

// ---------------------------------------------------------------------------
// DB fetch — thin queries, no formatting. Not unit-tested (covered manually
// and by the pure assembly tests above).
// ---------------------------------------------------------------------------

export async function fetchExportInput(userId: string): Promise<ExportInput> {
	const [profileRow] = await db
		.select({
			handle: profile.handle,
			displayName: profile.displayName,
			bio: profile.bio,
			pronouns: profile.pronouns,
			location: profile.location,
			website: profile.website,
			favoriteMovieIds: profile.favoriteMovieIds,
			createdAt: profile.createdAt,
		})
		.from(profile)
		.where(eq(profile.userId, userId));
	if (!profileRow) throw new Error("PROFILE_NOT_FOUND");

	const [userRow] = await db
		.select({ email: user.email, createdAt: user.createdAt })
		.from(user)
		.where(eq(user.id, userId));

	const favoriteFilmsRaw =
		profileRow.favoriteMovieIds.length > 0
			? await db
					.select({
						title: movie.title,
						year: movie.year,
						tmdbId: movie.tmdbId,
					})
					.from(movie)
					.where(inArray(movie.tmdbId, profileRow.favoriteMovieIds))
			: [];
	// Preserve the patron's pinned order from profile.favoriteMovieIds.
	const favoriteByTmdbId = new Map(
		favoriteFilmsRaw.map((row) => [row.tmdbId, row]),
	);
	const favoriteFilms = profileRow.favoriteMovieIds
		.map((id) => favoriteByTmdbId.get(id))
		.filter((row): row is (typeof favoriteFilmsRaw)[number] => row != null);

	const filmLogs = await db
		.select({
			title: movie.title,
			year: movie.year,
			tmdbId: movie.tmdbId,
			watchedAt: log.watchedAt,
			createdAt: log.createdAt,
			rating: log.rating,
			rewatch: log.rewatch,
			liked: log.liked,
			note: log.note,
		})
		.from(log)
		.innerJoin(movie, eq(log.movieId, movie.tmdbId))
		.where(
			and(
				eq(log.userId, userId),
				isNotNull(log.movieId),
				isNull(log.removedAt),
			),
		)
		.orderBy(asc(log.watchedAt), asc(log.createdAt));

	const tvLogs = await db
		.select({
			title: tv.title,
			year: tv.year,
			tmdbId: tv.tmdbId,
			watchedAt: log.watchedAt,
			createdAt: log.createdAt,
			rating: log.rating,
			rewatch: log.rewatch,
			liked: log.liked,
			note: log.note,
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			episodeNumber: log.episodeNumber,
		})
		.from(log)
		.innerJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(
			and(eq(log.userId, userId), isNotNull(log.tvId), isNull(log.removedAt)),
		)
		.orderBy(asc(log.watchedAt), asc(log.createdAt));

	const filmWatchlist = await db
		.select({
			title: movie.title,
			year: movie.year,
			tmdbId: movie.tmdbId,
			addedAt: watchlistItem.addedAt,
		})
		.from(watchlistItem)
		.innerJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
		.where(
			and(eq(watchlistItem.userId, userId), isNotNull(watchlistItem.movieId)),
		)
		.orderBy(asc(watchlistItem.addedAt));

	const tvWatchlist = await db
		.select({
			title: tv.title,
			year: tv.year,
			tmdbId: tv.tmdbId,
			addedAt: watchlistItem.addedAt,
		})
		.from(watchlistItem)
		.innerJoin(tv, eq(watchlistItem.tvId, tv.tmdbId))
		.where(and(eq(watchlistItem.userId, userId), isNotNull(watchlistItem.tvId)))
		.orderBy(asc(watchlistItem.addedAt));

	const tvProgress = await db
		.select({
			title: tv.title,
			year: tv.year,
			tmdbId: tv.tmdbId,
			status: tvWatch.status,
			lastSeason: tvWatch.lastSeason,
			lastEpisode: tvWatch.lastEpisode,
			startedAt: tvWatch.startedAt,
			statusChangedAt: tvWatch.statusChangedAt,
		})
		.from(tvWatch)
		.innerJoin(tv, eq(tvWatch.tvId, tv.tmdbId))
		.where(eq(tvWatch.userId, userId))
		.orderBy(asc(tvWatch.startedAt));

	const reviews = await db
		.select({
			title: movie.title,
			year: movie.year,
			tmdbId: movie.tmdbId,
			reviewTitle: review.title,
			body: review.body,
			rating: review.rating,
			containsSpoilers: review.containsSpoilers,
			publishedAt: review.publishedAt,
			watchedAt: log.watchedAt,
		})
		.from(review)
		.innerJoin(movie, eq(review.movieId, movie.tmdbId))
		.leftJoin(log, eq(review.logId, log.id))
		.where(and(eq(review.userId, userId), isNull(review.removedAt)))
		.orderBy(asc(review.publishedAt));

	const ownedLists = await db
		.select({
			id: list.id,
			title: list.title,
			description: list.description,
			isRanked: list.isRanked,
		})
		.from(list)
		.where(and(eq(list.userId, userId), isNull(list.removedAt)))
		.orderBy(asc(list.createdAt));

	const listsWithItems: ExportInput["lists"] = [];
	for (const owned of ownedLists) {
		const movieItems = await db
			.select({
				position: listItem.position,
				title: movie.title,
				year: movie.year,
				tmdbId: movie.tmdbId,
				note: listItem.note,
				addedAt: listItem.addedAt,
			})
			.from(listItem)
			.innerJoin(movie, eq(listItem.movieId, movie.tmdbId))
			.where(and(eq(listItem.listId, owned.id), isNotNull(listItem.movieId)));
		const tvItems = await db
			.select({
				position: listItem.position,
				title: tv.title,
				year: tv.year,
				tmdbId: tv.tmdbId,
				note: listItem.note,
				addedAt: listItem.addedAt,
			})
			.from(listItem)
			.innerJoin(tv, eq(listItem.tvId, tv.tmdbId))
			.where(and(eq(listItem.listId, owned.id), isNotNull(listItem.tvId)));
		listsWithItems.push({
			title: owned.title,
			description: owned.description,
			isRanked: owned.isRanked,
			items: [
				...movieItems.map((i) => ({ ...i, mediaType: "film" as const })),
				...tvItems.map((i) => ({ ...i, mediaType: "tv" as const })),
			].sort(
				(a, b) =>
					a.position - b.position ||
					new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
			),
		});
	}

	const comments = await db
		.select({
			parentType: comment.parentType,
			parentId: comment.parentId,
			body: comment.body,
			createdAt: comment.createdAt,
		})
		.from(comment)
		.where(and(eq(comment.userId, userId), isNull(comment.deletedAt)))
		.orderBy(asc(comment.createdAt));

	const likedReviews = await db
		.select({
			reviewId: reaction.parentId,
			movieTitle: movie.title,
			likedAt: reaction.createdAt,
		})
		.from(reaction)
		.leftJoin(review, eq(reaction.parentId, review.id))
		.leftJoin(movie, eq(review.movieId, movie.tmdbId))
		.where(
			and(
				eq(reaction.userId, userId),
				eq(reaction.parentType, "review"),
				eq(reaction.kind, "like"),
			),
		)
		.orderBy(asc(reaction.createdAt));

	const likedLists = await db
		.select({
			listId: reaction.parentId,
			listTitle: list.title,
			likedAt: reaction.createdAt,
		})
		.from(reaction)
		.leftJoin(list, eq(reaction.parentId, list.id))
		.where(
			and(
				eq(reaction.userId, userId),
				eq(reaction.parentType, "list"),
				eq(reaction.kind, "like"),
			),
		)
		.orderBy(asc(reaction.createdAt));

	return {
		profile: {
			handle: profileRow.handle,
			displayName: profileRow.displayName,
			bio: profileRow.bio,
			pronouns: profileRow.pronouns,
			location: profileRow.location,
			website: profileRow.website,
			joinedAt: userRow?.createdAt ?? profileRow.createdAt,
			email: userRow?.email ?? "",
		},
		favoriteFilms,
		filmLogs,
		tvLogs,
		filmWatchlist,
		tvWatchlist,
		tvProgress,
		reviews,
		lists: listsWithItems,
		comments,
		likedReviews,
		likedLists,
	};
}
