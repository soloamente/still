/**
 * Rule-based taste signature (Sense Tier 0) — no LLM.
 * Describes what patrons watch and gravitate toward — not how they score.
 */

import { buildTastePillLabel } from "./taste-persona-lexicon";

export type TasteSignatureConfidence = "low" | "medium" | "high";

export type TasteArchetype =
	| "forming"
	| "contrarian"
	| "genre-purist"
	| "dual-affinity"
	| "generous"
	| "selective"
	| "genre-led"
	| "eclectic"
	| "curator";

/** Bump when headline logic changes — triggers lazy recompute on profile load. */
export const TASTE_SIGNATURE_VERSION = 4;

export type TastePillGenres = {
	primary: string;
	secondary?: string;
	tertiary?: string;
};

export interface TasteSignaturePayload {
	archetype: TasteArchetype;
	headlineSelf: string;
	headlineVisitor: string;
	/** Backward compat — mirrors headlineSelf */
	headline: string;
	confidence: TasteSignatureConfidence;
	version: typeof TASTE_SIGNATURE_VERSION;
	/** Patron-facing pill label — e.g. Dramatist, Dramatist & Toonist */
	pillLabel?: string;
	/** Capitalized genre names for pill popover copy */
	pillGenres?: TastePillGenres;
}

export interface TasteSignatureLogSlice {
	genreIds: number[];
	/** Stored log.rating (tenths 0–100 or legacy 1–10). */
	rating: number | null;
	/** TMDb vote_average on 0–10 scale when available. */
	tmdbVoteAverage: number | null;
	title?: string | null;
}

type TasteTemplatePair = { self: string; visitor: string };

type TasteStats = {
	logCount: number;
	genreWeights: Map<number, number>;
	totalGenreTags: number;
	primaryGenreId: number | null;
	secondaryGenreId: number | null;
	tertiaryGenreId: number | null;
	primaryShare: number;
	dualShare: number;
};

/** TMDB movie genre id → display name (English). */
const TMDB_GENRE_NAMES: Record<number, string> = {
	28: "action",
	12: "adventure",
	16: "animation",
	35: "comedy",
	80: "crime",
	99: "documentary",
	18: "drama",
	10751: "family",
	14: "fantasy",
	36: "history",
	27: "horror",
	10402: "music",
	9648: "mystery",
	10749: "romance",
	878: "science fiction",
	10770: "TV movie",
	53: "thriller",
	10752: "war",
	37: "western",
	10759: "action & adventure",
	10762: "kids",
	10763: "news",
	10764: "reality",
	10765: "sci-fi & fantasy",
	10766: "soap",
	10767: "talk",
	10768: "war & politics",
};

const ARCHETYPE_TEMPLATES: Record<
	Exclude<TasteArchetype, "forming" | "contrarian" | "generous" | "selective">,
	TasteTemplatePair[]
> = {
	"genre-purist": [
		{
			self: "Drawn to {genre} above all else — most of your diary lives there.",
			visitor:
				"Drawn to {genre} above all else — most of this diary lives there.",
		},
		{
			self: "You keep returning to {genre}; it's the through-line of your taste.",
			visitor:
				"Keeps returning to {genre}; it's the through-line of this taste.",
		},
	],
	"dual-affinity": [
		{
			self: "You gravitate toward {genreA} and {genreB} — that pairing defines your log.",
			visitor:
				"Gravitates toward {genreA} and {genreB} — that pairing defines this log.",
		},
		{
			self: "{genreA} and {genreB} show up together more than any other mix in your diary.",
			visitor:
				"{genreA} and {genreB} show up together more than any other mix here.",
		},
	],
	"genre-led": [
		{
			self: "Leans {genre}-heavy, with steady helpings of {genreB} and {genreC}.",
			visitor:
				"Leans {genre}-heavy, with steady helpings of {genreB} and {genreC}.",
		},
		{
			self: "Your taste centers on {genre}, but {genreB} and {genreC} stay in rotation.",
			visitor:
				"Taste centers on {genre}, but {genreB} and {genreC} stay in rotation.",
		},
	],
	eclectic: [
		{
			self: "Wide range — {genreA}, {genreB}, and {genreC} all get meaningful play.",
			visitor:
				"Wide range — {genreA}, {genreB}, and {genreC} all get meaningful play.",
		},
		{
			self: "No single lane: you spread love across {genrePhrase}.",
			visitor: "No single lane: spreads attention across {genrePhrase}.",
		},
	],
	curator: [
		{
			self: "A broad diary still taking shape — log more titles to surface clearer affinities.",
			visitor:
				"A broad diary still taking shape — not enough genre signal yet.",
		},
		{
			self: "Your watch history is varied; a few more logs will sharpen what you reach for.",
			visitor:
				"Watch history is varied; a few more logs will sharpen what they reach for.",
		},
	],
};

const FORMING_TEMPLATES: TasteTemplatePair[] = [
	{
		self: "Your taste map is still forming — a few more logs and Sense can name what you reach for.",
		visitor:
			"Taste map still forming — not enough logs yet to name clear affinities.",
	},
	{
		self: "Sense is still learning your taste — log a few titles or import a diary to begin.",
		visitor: "Taste map still forming — not enough logs yet.",
	},
];

function genreLabel(id: number): string {
	return TMDB_GENRE_NAMES[id] ?? "film";
}

/** Popover-facing genre name — capitalize first letter of TMDb label. */
function genreDisplayName(id: number): string {
	const label = genreLabel(id);
	return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildPillGenres(stats: TasteStats): TastePillGenres | undefined {
	if (stats.primaryGenreId == null) return undefined;
	return {
		primary: genreDisplayName(stats.primaryGenreId),
		secondary:
			stats.secondaryGenreId != null
				? genreDisplayName(stats.secondaryGenreId)
				: undefined,
		tertiary:
			stats.tertiaryGenreId != null
				? genreDisplayName(stats.tertiaryGenreId)
				: undefined,
	};
}

function logCountBucket(count: number): string {
	if (count === 0) return "0";
	if (count < 5) return "1-4";
	if (count < 10) return "5-9";
	if (count < 20) return "10-19";
	return "20+";
}

/** Stable pick — same taste profile keeps the same template until signals shift. */
function stableTemplateIndex(key: string, poolLength: number): number {
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
	}
	return poolLength === 0 ? 0 : hash % poolLength;
}

function buildTasteStats(slices: TasteSignatureLogSlice[]): TasteStats {
	const genreWeights = new Map<number, number>();
	let totalGenreTags = 0;

	for (const slice of slices) {
		for (const id of slice.genreIds) {
			genreWeights.set(id, (genreWeights.get(id) ?? 0) + 1);
			totalGenreTags++;
		}
	}

	const ranked = [...genreWeights.entries()].sort((a, b) => b[1] - a[1]);
	const primaryGenreId = ranked[0]?.[0] ?? null;
	const secondaryGenreId = ranked[1]?.[0] ?? null;
	const tertiaryGenreId = ranked[2]?.[0] ?? null;
	const primaryWeight = ranked[0]?.[1] ?? 0;
	const secondaryWeight = ranked[1]?.[1] ?? 0;

	const primaryShare = totalGenreTags > 0 ? primaryWeight / totalGenreTags : 0;
	const dualShare =
		totalGenreTags > 0 ? (primaryWeight + secondaryWeight) / totalGenreTags : 0;

	return {
		logCount: slices.length,
		genreWeights,
		totalGenreTags,
		primaryGenreId,
		secondaryGenreId,
		tertiaryGenreId,
		primaryShare,
		dualShare,
	};
}

function topGenrePhrase(stats: TasteStats, max = 3): string {
	const ranked = [...stats.genreWeights.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, max)
		.map(([id]) => genreLabel(id));

	if (ranked.length === 0) return "film";
	if (ranked.length === 1) return ranked[0];
	if (ranked.length === 2) return `${ranked[0]} and ${ranked[1]}`;
	return `${ranked[0]}, ${ranked[1]}, and ${ranked[2]}`;
}

/** Genre-first only — never scoring style or crowd comparison. */
export function classifyTasteArchetype(stats: TasteStats): TasteArchetype {
	if (stats.logCount < 5) return "forming";

	if (stats.primaryShare >= 0.4 && stats.primaryGenreId != null) {
		return "genre-purist";
	}

	if (
		stats.dualShare >= 0.5 &&
		stats.primaryGenreId != null &&
		stats.secondaryGenreId != null &&
		stats.primaryGenreId !== stats.secondaryGenreId
	) {
		return "dual-affinity";
	}

	if (stats.primaryGenreId != null && stats.primaryShare >= 0.2) {
		return "genre-led";
	}

	if (stats.totalGenreTags > 0) {
		return "eclectic";
	}

	return "curator";
}

function fillTemplate(template: string, stats: TasteStats): string {
	const primary =
		stats.primaryGenreId != null ? genreLabel(stats.primaryGenreId) : "film";
	const secondary =
		stats.secondaryGenreId != null
			? genreLabel(stats.secondaryGenreId)
			: primary;
	const tertiary =
		stats.tertiaryGenreId != null
			? genreLabel(stats.tertiaryGenreId)
			: secondary;

	return template
		.replaceAll("{genre}", primary)
		.replaceAll("{genreA}", primary)
		.replaceAll("{genreB}", secondary)
		.replaceAll("{genreC}", tertiary)
		.replaceAll("{genrePhrase}", topGenrePhrase(stats));
}

function renderHeadlines(
	archetype: TasteArchetype,
	stats: TasteStats,
): { headlineSelf: string; headlineVisitor: string } {
	const stableKey = [
		archetype,
		stats.primaryGenreId ?? "none",
		stats.secondaryGenreId ?? "none",
		stats.tertiaryGenreId ?? "none",
		logCountBucket(stats.logCount),
	].join(":");

	if (archetype === "forming") {
		const index = stableTemplateIndex(
			stableKey,
			stats.logCount === 0 ? 1 : FORMING_TEMPLATES.length,
		);
		const pair =
			stats.logCount === 0 ? FORMING_TEMPLATES[1] : FORMING_TEMPLATES[index];
		return { headlineSelf: pair.self, headlineVisitor: pair.visitor };
	}

	const pool =
		ARCHETYPE_TEMPLATES[archetype as keyof typeof ARCHETYPE_TEMPLATES] ??
		ARCHETYPE_TEMPLATES.curator;
	const index = stableTemplateIndex(stableKey, pool.length);
	const pair = pool[index];

	return {
		headlineSelf: fillTemplate(pair.self, stats),
		headlineVisitor: fillTemplate(pair.visitor, stats),
	};
}

function tasteConfidence(logCount: number): TasteSignatureConfidence {
	if (logCount >= 20) return "high";
	if (logCount >= 10) return "medium";
	return "low";
}

function buildPayload(
	archetype: TasteArchetype,
	headlineSelf: string,
	headlineVisitor: string,
	confidence: TasteSignatureConfidence,
	stats: TasteStats,
): TasteSignaturePayload {
	const pillLabel = buildTastePillLabel(archetype, {
		primaryGenreId: stats.primaryGenreId,
		secondaryGenreId: stats.secondaryGenreId,
		tertiaryGenreId: stats.tertiaryGenreId,
		logCount: stats.logCount,
	});
	const pillGenres = pillLabel != null ? buildPillGenres(stats) : undefined;

	return {
		archetype,
		headlineSelf,
		headlineVisitor,
		headline: headlineSelf,
		confidence,
		version: TASTE_SIGNATURE_VERSION,
		...(pillLabel != null ? { pillLabel } : {}),
		...(pillGenres != null ? { pillGenres } : {}),
	};
}

/**
 * Builds patron taste headline from diary slices. Pure — safe to unit test.
 */
export function computeTasteSignatureFromLogs(
	slices: TasteSignatureLogSlice[],
): TasteSignaturePayload {
	const stats = buildTasteStats(slices);
	const archetype = classifyTasteArchetype(stats);
	const { headlineSelf, headlineVisitor } = renderHeadlines(archetype, stats);
	const confidence = tasteConfidence(stats.logCount);

	return buildPayload(
		archetype,
		headlineSelf,
		headlineVisitor,
		confidence,
		stats,
	);
}
