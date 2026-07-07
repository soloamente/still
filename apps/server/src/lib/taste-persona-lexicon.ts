import type { TasteArchetype } from "./sense-taste-signature";

/** Target max characters for profile taste pill labels. */
export const MAX_PILL_LABEL_LENGTH = 28;

/** Non-genre identities when taste is spread across many lanes — single token for profile pills. */
export const ECLECTIC_PERSONA_POOL = [
	"Omnivore",
	"Rover",
	"Polyglot",
	"Wanderer",
] as const;

type GenrePersonaEntry = {
	persona: string;
	shortPersona?: string;
};

/** TMDb genre id → patron-facing persona noun (spec v1 lexicon). */
const GENRE_PERSONA_LEXICON: Record<number, GenrePersonaEntry> = {
	18: { persona: "Dramatist" },
	35: { persona: "Comedian", shortPersona: "Comic" },
	27: { persona: "Nightwatcher" },
	53: { persona: "Thrill-seeker", shortPersona: "Thriller" },
	878: { persona: "Futurist", shortPersona: "Sci-fi" },
	10749: { persona: "Romantic" },
	16: { persona: "Toonist" },
	99: { persona: "Documentarian", shortPersona: "Docs" },
	14: { persona: "Fantasist" },
	9648: { persona: "Sleuth" },
	80: { persona: "Noirist" },
	28: { persona: "Adrenalist", shortPersona: "Action" },
	12: { persona: "Adventurer" },
	37: { persona: "Westerner" },
	36: { persona: "Historian" },
	10402: { persona: "Melophile" },
	10751: { persona: "Storykeeper", shortPersona: "Family" },
	10752: { persona: "Chronicler" },
	10759: { persona: "Adventurer" },
	10765: { persona: "Futurist" },
	10762: { persona: "Storykeeper", shortPersona: "Kids" },
	10764: { persona: "Voyeur" },
	10766: { persona: "Serialist" },
	10767: { persona: "Conversationalist", shortPersona: "Talk" },
	10768: { persona: "Chronicler" },
	10763: { persona: "Chronicler", shortPersona: "News" },
	10770: { persona: "Cinephile" },
};

const FALLBACK_PERSONA = "Cinephile";

export type TastePillLabelInput = {
	primaryGenreId: number | null;
	secondaryGenreId: number | null;
	tertiaryGenreId: number | null;
	logCount: number;
};

function lexiconEntry(genreId: number): GenrePersonaEntry {
	return GENRE_PERSONA_LEXICON[genreId] ?? { persona: FALLBACK_PERSONA };
}

/** Patron-facing persona for one TMDb genre id. */
export function personaForGenreId(genreId: number): string {
	return lexiconEntry(genreId).persona;
}

/** Shorter persona for duo pills when the full label would overflow. */
export function shortPersonaForGenreId(genreId: number): string {
	const entry = lexiconEntry(genreId);
	return entry.shortPersona ?? entry.persona;
}

function logCountBucket(count: number): string {
	if (count === 0) return "0";
	if (count < 5) return "1-4";
	if (count < 10) return "5-9";
	if (count < 20) return "10-19";
	return "20+";
}

/** Stable pick — same inputs keep the same eclectic label. */
function stableTemplateIndex(key: string, poolLength: number): number {
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
	}
	return poolLength === 0 ? 0 : hash % poolLength;
}

function eclecticStableKey(input: TastePillLabelInput): string {
	return [
		"eclectic",
		input.primaryGenreId ?? "none",
		input.secondaryGenreId ?? "none",
		input.tertiaryGenreId ?? "none",
		logCountBucket(input.logCount),
	].join(":");
}

export function buildEclecticPillLabel(input: TastePillLabelInput): string {
	const index = stableTemplateIndex(
		eclecticStableKey(input),
		ECLECTIC_PERSONA_POOL.length,
	);
	return ECLECTIC_PERSONA_POOL[index] ?? ECLECTIC_PERSONA_POOL[0];
}

function formatDuoLabel(primaryGenreId: number): string {
	// Profile pills stay one word — duo detail lives in the popover via pillGenres.
	return shortPersonaForGenreId(primaryGenreId);
}

/**
 * Builds the profile taste pill label from archetype + top genre ids.
 * Returns null when the archetype should not show a pill.
 */
export function buildTastePillLabel(
	archetype: TasteArchetype,
	input: TastePillLabelInput,
): string | null {
	switch (archetype) {
		case "genre-purist":
		case "genre-led": {
			if (input.primaryGenreId == null) return null;
			return personaForGenreId(input.primaryGenreId);
		}
		case "dual-affinity": {
			if (input.primaryGenreId == null || input.secondaryGenreId == null) {
				return input.primaryGenreId != null
					? personaForGenreId(input.primaryGenreId)
					: null;
			}
			return formatDuoLabel(input.primaryGenreId);
		}
		case "eclectic":
			return buildEclecticPillLabel(input);
		case "forming":
		case "contrarian":
		case "generous":
		case "selective":
		case "curator":
			return null;
		default: {
			const _exhaustive: never = archetype;
			return _exhaustive;
		}
	}
}
