import { movie, tv } from "@still/db";
import {
	type AnyColumn,
	and,
	eq,
	isNull,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

/** SQL fragment — hide adult movies when patron pref is off. */
export function movieNotAdultSql(showAdultContent: boolean): SQL | undefined {
	if (showAdultContent) return undefined;
	return eq(movie.adult, false);
}

/** SQL fragment — hide adult TV (TMDb flag + cached MAL `_stillAdult`). */
export function tvNotAdultSql(showAdultContent: boolean): SQL | undefined {
	if (showAdultContent) return undefined;
	return and(
		eq(tv.adult, false),
		or(
			isNull(tv.tmdbJson),
			sql`coalesce((${tv.tmdbJson}->'_stillAdult'->>'isAdult')::boolean, false) = false`,
		),
	);
}

/**
 * SQL for watchlist/list rows with left-joined `movie` + `tv` — each item is a
 * film OR a show; the null side of the join must not fail the adult predicate.
 */
export function joinedTitleItemNotAdultSql(
	showAdultContent: boolean,
	itemCols: { movieId: AnyColumn; tvId: AnyColumn },
): SQL | undefined {
	if (showAdultContent) return undefined;
	return and(
		or(isNull(itemCols.movieId), movieNotAdultSql(false)),
		or(isNull(itemCols.tvId), tvNotAdultSql(false)),
	);
}
