import { log, tv } from "@still/db";
import { sql } from "drizzle-orm";

/** Mirrors diary `log.log_scope` for TV rows. */
type TvLogScope = "show" | "season" | "episode";

/** Minimal season row shape from TMDb / `_stillSeasons` cache. */
export type EpisodeWeightSeason = {
	season_number: number;
	episode_count: number;
};

/**
 * Resolve episode_count for one season from TMDb season lists.
 * Prefers `_stillSeasons` (Sense cache) then top-level `seasons`.
 */
export function episodeCountForSeason(
	seasons: EpisodeWeightSeason[] | null | undefined,
	seasonNumber: number | null | undefined,
): number | null {
	if (seasonNumber == null || !seasons?.length) return null;
	const match = seasons.find((s) => s.season_number === seasonNumber);
	if (!match) return null;
	const n = Number(match.episode_count);
	if (!Number.isFinite(n) || n < 1) return null;
	return Math.floor(n);
}

function asSeasonList(value: unknown): EpisodeWeightSeason[] {
	if (!Array.isArray(value)) return [];
	const out: EpisodeWeightSeason[] = [];
	for (const raw of value) {
		if (!raw || typeof raw !== "object") continue;
		const row = raw as Record<string, unknown>;
		const season_number = Number(row.season_number);
		const episode_count = Number(row.episode_count);
		if (!Number.isFinite(season_number) || !Number.isFinite(episode_count)) {
			continue;
		}
		out.push({ season_number, episode_count });
	}
	return out;
}

/** Seasons used for weighting — Sense cache first, then TMDb payload. */
export function seasonsFromTvTmdbJson(
	tmdbJson: Record<string, unknown> | null | undefined,
): EpisodeWeightSeason[] {
	if (!tmdbJson) return [];
	const still = tmdbJson._stillSeasons;
	if (still && typeof still === "object") {
		const cached = asSeasonList((still as { seasons?: unknown }).seasons);
		if (cached.length > 0) return cached;
	}
	return asSeasonList(tmdbJson.seasons);
}

/**
 * Series episode total for a show-scoped diary log.
 * Prefers `number_of_episodes`, else sum of regular seasons (season_number > 0).
 */
export function showEpisodeCountFromTmdbJson(
	tmdbJson: Record<string, unknown> | null | undefined,
): number {
	if (!tmdbJson) return 1;
	const direct = Number(tmdbJson.number_of_episodes);
	if (Number.isFinite(direct) && direct >= 1) return Math.floor(direct);

	const seasons = seasonsFromTvTmdbJson(tmdbJson);
	const sum = seasons
		.filter((s) => s.season_number > 0)
		.reduce((acc, s) => acc + Math.max(0, Math.floor(s.episode_count)), 0);
	return sum >= 1 ? sum : 1;
}

/**
 * Episode-equivalent weight for one public TV diary row on the Episodes board.
 * `episode` → 1; `season` → season episode_count (≥1); `show` → series total (≥1).
 */
export function weightForEpisodeRankLog(
	scope: TvLogScope | string | null | undefined,
	seasonNumber: number | null | undefined,
	tmdbJson: Record<string, unknown> | null | undefined,
): number {
	if (scope === "episode") return 1;
	if (scope === "season") {
		const n = episodeCountForSeason(
			seasonsFromTvTmdbJson(tmdbJson),
			seasonNumber,
		);
		return n ?? 1;
	}
	if (scope === "show") {
		return showEpisodeCountFromTmdbJson(tmdbJson);
	}
	return 1;
}

type DedupeLog = {
	id: string;
	tvId: number | null;
	logScope: string | null;
	seasonNumber: number | null;
};

/**
 * Within one patron's period window: episode logs win a season; any season/episode
 * log for a title suppresses a show log. Pure helper for tests + ledger filtering.
 */
export function selectLogsForEpisodeRank(logs: DedupeLog[]): DedupeLog[] {
	const byTv = new Map<number, DedupeLog[]>();
	for (const row of logs) {
		if (row.tvId == null) continue;
		const bucket = byTv.get(row.tvId);
		if (bucket) bucket.push(row);
		else byTv.set(row.tvId, [row]);
	}

	const kept: DedupeLog[] = [];
	for (const group of byTv.values()) {
		const seasonsWithEpisodeLogs = new Set<number>();
		let hasSeasonOrEpisode = false;
		for (const row of group) {
			if (row.logScope === "episode") {
				hasSeasonOrEpisode = true;
				if (row.seasonNumber != null) {
					seasonsWithEpisodeLogs.add(row.seasonNumber);
				}
			} else if (row.logScope === "season") {
				hasSeasonOrEpisode = true;
			}
		}
		for (const row of group) {
			if (row.logScope === "episode") {
				kept.push(row);
				continue;
			}
			if (row.logScope === "season") {
				if (
					row.seasonNumber != null &&
					seasonsWithEpisodeLogs.has(row.seasonNumber)
				) {
					continue;
				}
				kept.push(row);
				continue;
			}
			if (row.logScope === "show") {
				if (hasSeasonOrEpisode) continue;
				kept.push(row);
			}
		}
	}
	return kept;
}

/**
 * SQL weight for `kind=episodes` aggregates — requires `log` left-joined to `tv`.
 * Mirrors `weightForEpisodeRankLog` against `tv.tmdb_json`.
 */
export function sqlEpisodeRankWeight() {
	return sql`case
    when ${log.logScope} = 'episode' then 1
    when ${log.logScope} = 'season' then greatest(
      coalesce(
        (
          select (s->>'episode_count')::int
          from jsonb_array_elements(
            coalesce(${tv.tmdbJson}->'_stillSeasons'->'seasons', '[]'::jsonb)
          ) as s
          where (s->>'season_number')::int = ${log.seasonNumber}
          limit 1
        ),
        (
          select (s->>'episode_count')::int
          from jsonb_array_elements(
            coalesce(${tv.tmdbJson}->'seasons', '[]'::jsonb)
          ) as s
          where (s->>'season_number')::int = ${log.seasonNumber}
          limit 1
        ),
        1
      ),
      1
    )
    when ${log.logScope} = 'show' then greatest(
      coalesce(
        (${tv.tmdbJson}->>'number_of_episodes')::int,
        (
          select sum((s->>'episode_count')::int)::int
          from jsonb_array_elements(
            coalesce(
              nullif(${tv.tmdbJson}->'_stillSeasons'->'seasons', 'null'::jsonb),
              coalesce(${tv.tmdbJson}->'seasons', '[]'::jsonb)
            )
          ) as s
          where coalesce((s->>'season_number')::int, 0) > 0
        ),
        1
      ),
      1
    )
    else 1
  end`;
}

/**
 * Episodes board includes episode + season + show diary scopes with period dedupe:
 * episode rows win over a season log for the same tv+season; any season/episode
 * activity for a title suppresses a show log in the same window.
 */
export function sqlEpisodesRankScopePredicate(start: Date, end: Date) {
	const episodeExistsForSeason = sql`exists (
    select 1 from ${log} as ep
    where ep.user_id = ${log.userId}
      and ep.tv_id = ${log.tvId}
      and ep.season_number is not distinct from ${log.seasonNumber}
      and ep.log_scope = 'episode'
      and ep.removed_at is null
      and ep.visibility = 'public'
      and ep.watched_at >= ${start}
      and ep.watched_at < ${end}
  )`;

	const seasonOrEpisodeExistsForShow = sql`exists (
    select 1 from ${log} as child
    where child.user_id = ${log.userId}
      and child.tv_id = ${log.tvId}
      and child.log_scope in ('season', 'episode')
      and child.removed_at is null
      and child.visibility = 'public'
      and child.watched_at >= ${start}
      and child.watched_at < ${end}
  )`;

	return sql`(
    ${log.logScope} = 'episode'
    or (
      ${log.logScope} = 'season'
      and not ${episodeExistsForSeason}
    )
    or (
      ${log.logScope} = 'show'
      and not ${seasonOrEpisodeExistsForShow}
    )
  )`;
}
