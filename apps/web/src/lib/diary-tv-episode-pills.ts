import { formatLogRatingDisplay, logRatingToDisplay } from "@/lib/log-rating";

export type DiaryTvEpisodeLog = {
	id: string;
	logScope: "show" | "season" | "episode";
	seasonNumber: number | null;
	episodeNumber: number | null;
	/** Stored tenths, or null when the log has no rating. */
	rating: number | null;
	watchedAt: string;
};

export type DiaryTvPill =
	| { kind: "empty"; latestLogId: null; averageDisplay: null }
	| { kind: "neutral"; latestLogId: string; averageDisplay: null }
	| { kind: "rated"; latestLogId: string; averageDisplay: number };

export function pillForEpisode(
	episode: { seasonNumber: number; episodeNumber: number },
	logs: readonly DiaryTvEpisodeLog[],
): DiaryTvPill {
	const matches = logs.filter(
		(log) =>
			log.logScope === "episode" &&
			log.seasonNumber === episode.seasonNumber &&
			log.episodeNumber === episode.episodeNumber,
	);
	if (matches.length === 0) {
		return { kind: "empty", latestLogId: null, averageDisplay: null };
	}
	const latest = [...matches].sort((a, b) =>
		a.watchedAt < b.watchedAt ? 1 : -1,
	)[0];
	const rated = matches
		.map((log) => logRatingToDisplay(log.rating))
		.filter((value): value is number => value != null);
	if (rated.length === 0) {
		return { kind: "neutral", latestLogId: latest.id, averageDisplay: null };
	}
	const average = rated.reduce((sum, value) => sum + value, 0) / rated.length;
	return {
		kind: "rated",
		latestLogId: latest.id,
		averageDisplay: Math.round(average * 10) / 10,
	};
}

/**
 * Mean of each episode's own average in one season.
 * One episode logged five times counts once, the same way its cell does.
 */
export function seasonEpisodeAverage(
	seasonNumber: number,
	logs: readonly DiaryTvEpisodeLog[],
): { averageDisplay: number; ratedCount: number } | null {
	const episodeNumbers = new Set<number>();
	for (const log of logs) {
		if (
			log.logScope === "episode" &&
			log.seasonNumber === seasonNumber &&
			log.episodeNumber != null
		) {
			episodeNumbers.add(log.episodeNumber);
		}
	}
	const scores: number[] = [];
	for (const episodeNumber of episodeNumbers) {
		const pill = pillForEpisode({ seasonNumber, episodeNumber }, logs);
		if (pill.kind === "rated") scores.push(pill.averageDisplay);
	}
	if (scores.length === 0) return null;
	const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
	return {
		averageDisplay: Math.round(average * 10) / 10,
		ratedCount: scores.length,
	};
}

/**
 * Score bands for the episode tiles.
 * 9–10 awesome, 8 great, 7 good, 6 regular, 4–5 bad, below 4 garbage.
 */
export type EpisodeScoreBand =
	| "awesome"
	| "great"
	| "good"
	| "regular"
	| "bad"
	| "garbage";

const EPISODE_SCORE_BAND_FILL: Record<
	EpisodeScoreBand,
	{ backgroundColor: string; color: string }
> = {
	awesome: { backgroundColor: "#178a45", color: "#ffffff" },
	great: { backgroundColor: "#2ea84f", color: "#ffffff" },
	good: { backgroundColor: "#f0c400", color: "#141414" },
	regular: { backgroundColor: "#f08c1a", color: "#141414" },
	bad: { backgroundColor: "#e23d3d", color: "#ffffff" },
	garbage: { backgroundColor: "#7b4fd4", color: "#ffffff" },
};

const EPISODE_SCORE_BAND_LABEL: Record<EpisodeScoreBand, string> = {
	awesome: "Awesome",
	great: "Great",
	good: "Good",
	regular: "Regular",
	bad: "Bad",
	garbage: "Garbage",
};

/** Same order and colors as the episode tiles, for the key above the seasons. */
export const EPISODE_SCORE_LEGEND: readonly {
	band: EpisodeScoreBand;
	label: string;
	backgroundColor: string;
}[] = (["awesome", "great", "good", "regular", "bad", "garbage"] as const).map(
	(band) => ({
		band,
		label: EPISODE_SCORE_BAND_LABEL[band],
		backgroundColor: EPISODE_SCORE_BAND_FILL[band].backgroundColor,
	}),
);

export function episodeScoreBand(score: number): EpisodeScoreBand {
	const value = Math.min(10, Math.max(0, score));
	if (value >= 9) return "awesome";
	if (value >= 8) return "great";
	if (value >= 7) return "good";
	if (value >= 6) return "regular";
	if (value >= 4) return "bad";
	return "garbage";
}

/** Fill and type color for a 0–10 episode score. */
export function episodeScoreBandFill(score: number): {
	backgroundColor: string;
	color: string;
} {
	return EPISODE_SCORE_BAND_FILL[episodeScoreBand(score)];
}

/**
 * Bar height for one episode score.
 * The scale is this season's spread, not 0–10, so 9.4 and 10 do not draw the same bar.
 */
export function episodeBarHeightPx(
	score: number,
	scores: readonly number[],
	bounds: { minPx: number; maxPx: number } = { minPx: 40, maxPx: 120 },
): number {
	const { minPx, maxPx } = bounds;
	if (scores.length === 0) return (minPx + maxPx) / 2;
	const min = Math.min(...scores);
	const max = Math.max(...scores);
	const pad = Math.max(0.45, (max - min) * 0.5);
	const domainMin = min - pad;
	const domainMax = max + pad * 0.2;
	const span = Math.max(domainMax - domainMin, 0.01);
	const t = Math.min(1, Math.max(0, (score - domainMin) / span));
	return Math.round(minPx + t * (maxPx - minPx));
}

export function initialSeasonNumber(
	logs: readonly DiaryTvEpisodeLog[],
	catalogueSeasonNumbers: readonly number[],
): number | null {
	const episodes = logs
		.filter((log) => log.logScope === "episode" && log.seasonNumber != null)
		.sort((a, b) => (a.watchedAt < b.watchedAt ? 1 : -1));
	if (episodes[0]?.seasonNumber != null) return episodes[0].seasonNumber;
	return catalogueSeasonNumbers[0] ?? null;
}

function latestScopeLog(
	logs: readonly DiaryTvEpisodeLog[],
): DiaryTvEpisodeLog | null {
	if (logs.length === 0) return null;
	return [...logs].sort((a, b) => (a.watchedAt < b.watchedAt ? 1 : -1))[0];
}

function scopeLabel(
	prefix: string,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	const latest = latestScopeLog(logs);
	if (latest == null) return null;
	const display = logRatingToDisplay(latest.rating);
	if (display == null) return prefix;
	return `${prefix} · ${formatLogRatingDisplay(display)}`;
}

/**
 * Score for a header that already prints the season name.
 * Null when that season has no log, or the latest season log is unrated.
 */
export function seasonLogScoreLabel(
	seasonNumber: number,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	const latest = latestScopeLog(
		logs.filter(
			(log) => log.logScope === "season" && log.seasonNumber === seasonNumber,
		),
	);
	if (latest == null) return null;
	const display = logRatingToDisplay(latest.rating);
	if (display == null) return null;
	return formatLogRatingDisplay(display);
}

export function showLogLabel(
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	return scopeLabel(
		"Whole series",
		logs.filter((log) => log.logScope === "show"),
	);
}

export function seasonLogLabel(
	seasonNumber: number,
	logs: readonly DiaryTvEpisodeLog[],
): string | null {
	return scopeLabel(
		`Season ${seasonNumber}`,
		logs.filter(
			(log) => log.logScope === "season" && log.seasonNumber === seasonNumber,
		),
	);
}
