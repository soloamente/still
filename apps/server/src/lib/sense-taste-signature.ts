/**
 * Rule-based taste signature (Sense Tier 0) — no LLM.
 * Copy should feel discovered: "You gravitate toward …" not genre tag spam.
 */

export type TasteSignatureConfidence = "low" | "medium" | "high";

export interface TasteSignaturePayload {
	headline: string;
	confidence: TasteSignatureConfidence;
}

export interface TasteSignatureLogSlice {
	genreIds: number[];
	/** Stored log.rating (tenths 0–100 or legacy 1–10). */
	rating: number | null;
	/** TMDb vote_average on 0–10 scale when available. */
	tmdbVoteAverage: number | null;
	title?: string | null;
}

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

function ratingToDisplayTen(stored: number): number {
	if (stored > 10) return stored / 10;
	return stored;
}

function genreLabel(id: number): string {
	return TMDB_GENRE_NAMES[id] ?? "film";
}

/**
 * Builds patron taste headline from diary slices. Pure — safe to unit test.
 */
export function computeTasteSignatureFromLogs(
	slices: TasteSignatureLogSlice[],
): TasteSignaturePayload {
	const count = slices.length;
	if (count === 0) {
		return {
			headline:
				"Sense is still learning your taste — log a few titles or import a diary to begin.",
			confidence: "low",
		};
	}
	if (count < 5) {
		return {
			headline:
				"Your taste map is forming — a few more logs and Sense can describe your lens more clearly.",
			confidence: "low",
		};
	}

	const genreWeights = new Map<number, number>();
	for (const slice of slices) {
		for (const id of slice.genreIds) {
			genreWeights.set(id, (genreWeights.get(id) ?? 0) + 1);
		}
	}
	const rankedGenres = [...genreWeights.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([id]) => id);

	const primary = rankedGenres[0];
	const secondary = rankedGenres[1];

	let genrePhrase: string;
	if (primary != null && secondary != null && primary !== secondary) {
		genrePhrase = `${genreLabel(primary)} and ${genreLabel(secondary)}`;
	} else if (primary != null) {
		genrePhrase = genreLabel(primary);
	} else {
		genrePhrase = "eclectic cinema";
	}

	const rated = slices.filter(
		(s) => s.rating != null && s.tmdbVoteAverage != null,
	);
	let contrarianNote: string | null = null;
	if (rated.length >= 3) {
		let bestGap = 0;
		let bestTitle: string | null = null;
		let userHigh = false;
		for (const s of rated) {
			const userScore = ratingToDisplayTen(s.rating as number);
			const tmdbScore = s.tmdbVoteAverage as number;
			const gap = userScore - tmdbScore;
			if (Math.abs(gap) > Math.abs(bestGap)) {
				bestGap = gap;
				bestTitle = s.title ?? null;
				userHigh = gap > 0;
			}
		}
		if (Math.abs(bestGap) >= 1.5 && bestTitle) {
			contrarianNote = userHigh
				? `You often score higher than the crowd — ${bestTitle} is one example.`
				: `You trust your own read over the consensus — ${bestTitle} stands out.`;
		}
	}

	const confidence: TasteSignatureConfidence =
		count >= 20 ? "high" : count >= 10 ? "medium" : "low";

	const headline = contrarianNote
		? `You gravitate toward ${genrePhrase}. ${contrarianNote}`
		: `You gravitate toward ${genrePhrase} — your diary reads like a curator, not a completionist.`;

	return { headline, confidence };
}
