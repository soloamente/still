import { db, log } from "@still/db";
import { and, desc, eq, sql } from "drizzle-orm";

import { makeId } from "./cuid";
import { letterboxdStarsToStoredTenths } from "./letterboxd-csv";

/** Stable match key for cross-phase title dedupe (URI preferred). */
export function letterboxdTitleMatchKey(input: {
	letterboxdUri: string | null;
	name: string;
	year: number | null;
}): string {
	const uri = input.letterboxdUri?.trim().toLowerCase();
	if (uri) return `lburi:${uri}`;
	return `lb:${input.name.trim().toLowerCase()}:${input.year ?? 0}`;
}

/** UTC noon on the import day — default watch date for minimal logs. */
export function utcNoonOnDay(day: Date): Date {
	return new Date(
		Date.UTC(
			day.getUTCFullYear(),
			day.getUTCMonth(),
			day.getUTCDate(),
			12,
			0,
			0,
		),
	);
}

export function defaultMinimalLogWatchedAt(
	watchedAt: Date | null,
	fallbackDate: Date | null,
	importDay: Date,
): Date {
	return watchedAt ?? fallbackDate ?? utcNoonOnDay(importDay);
}

export function letterboxdImportNote(letterboxdUri: string | null): string {
	return letterboxdUri
		? `Imported from Letterboxd (${letterboxdUri})`
		: "Imported from Letterboxd";
}

export async function anyLogExistsForMovie(
	userId: string,
	movieId: number,
): Promise<boolean> {
	const [row] = await db
		.select({ id: log.id })
		.from(log)
		.where(and(eq(log.userId, userId), eq(log.movieId, movieId)))
		.limit(1);
	return Boolean(row);
}

export async function findSameDayLog(
	userId: string,
	movieId: number,
	watchedAt: Date,
): Promise<{ id: string; rating: number | null } | null> {
	const [row] = await db
		.select({ id: log.id, rating: log.rating })
		.from(log)
		.where(
			and(
				eq(log.userId, userId),
				eq(log.movieId, movieId),
				sql`date_trunc('day', ${log.watchedAt}) = date_trunc('day', ${watchedAt}::timestamp)`,
			),
		)
		.limit(1);
	return row ?? null;
}

export async function findLatestLogForMovie(
	userId: string,
	movieId: number,
): Promise<{ id: string; rating: number | null; watchedAt: Date } | null> {
	const [row] = await db
		.select({
			id: log.id,
			rating: log.rating,
			watchedAt: log.watchedAt,
		})
		.from(log)
		.where(and(eq(log.userId, userId), eq(log.movieId, movieId)))
		.orderBy(desc(log.watchedAt))
		.limit(1);
	return row ?? null;
}

export async function fillLogRatingIfNull(
	logId: string,
	ratingStars: number,
): Promise<boolean> {
	const tenths = letterboxdStarsToStoredTenths(ratingStars);
	const [row] = await db
		.update(log)
		.set({ rating: tenths })
		.where(and(eq(log.id, logId), sql`${log.rating} IS NULL`))
		.returning({ id: log.id });
	return Boolean(row);
}

export async function createMinimalLetterboxdLog(input: {
	userId: string;
	movieId: number;
	watchedAt: Date;
	ratingStars: number | null;
	rewatch: boolean;
	letterboxdUri: string | null;
}): Promise<string> {
	const id = makeId("log");
	await db.insert(log).values({
		id,
		userId: input.userId,
		movieId: input.movieId,
		watchedAt: input.watchedAt,
		rating:
			input.ratingStars != null
				? letterboxdStarsToStoredTenths(input.ratingStars)
				: null,
		rewatch: input.rewatch,
		note: letterboxdImportNote(input.letterboxdUri),
		watchVenue: "streaming",
	});
	return id;
}

export async function setLogLiked(
	userId: string,
	logId: string,
	liked: boolean,
): Promise<void> {
	await db
		.update(log)
		.set({ liked })
		.where(and(eq(log.id, logId), eq(log.userId, userId)));
}
