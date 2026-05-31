/**
 * Pick a highlight color from TMDb genre names so each title page gets a
 * light “print” wash without shipping a client-side color sampler (avoids
 * canvas CORS + keeps the hero fast).
 *
 * Colors are **arthouse-leaning**: muted, drawn from the Aker palette family
 * (desert orange, copper clay, deep teal, moss, crimson blush) so heroes feel
 * consistent with the rest of Sense — not neon “multiplex” lobby LEDs.
 */

/** Default wash when no genre matches / none were synced yet. */
const DEFAULT_ACCENT = "#b75928";

/**
 * Primary TMDb genre name (lower case) → hex. Keep contrast reasonable on
 * near-black heroes — prefer depth over chroma.
 */
const GENRE_ACCENTS: Record<string, string> = {
	action: "#a24e24",
	adventure: "#0f4550",
	animation: "#8c4a28",
	comedy: "#9a6230",
	crime: "#1a3d32",
	documentary: "#5c534f",
	drama: "#6b564d",
	family: "#8f6a4a",
	fantasy: "#2d4a3e",
	history: "#5c4f47",
	horror: "#9a4546",
	music: "#8f4a2c",
	mystery: "#062f38",
	romance: "#8a5348",
	"science fiction": "#0d3a45",
	"tv movie": "#454545",
	thriller: "#0a3540",
	war: "#4a4542",
	western: "#6b5346",
};

/** Alternate labels → canonical key in `GENRE_ACCENTS`. */
const GENRE_ALIASES: Record<string, string> = {
	"sci-fi": "science fiction",
	scifi: "science fiction",
	sci: "science fiction",
	tvmovie: "tv movie",
};

export function accentFromGenres(
	genres: { name: string }[] | null | undefined,
): { accent: string; label: string | null } {
	if (!genres?.length) {
		return { accent: DEFAULT_ACCENT, label: null };
	}

	for (const g of genres) {
		const key = g.name.trim().toLowerCase();
		const mapped = GENRE_ALIASES[key] ?? key;
		const hex = GENRE_ACCENTS[mapped];
		if (hex) {
			return { accent: hex, label: g.name };
		}
	}

	return { accent: DEFAULT_ACCENT, label: genres[0]?.name ?? null };
}
