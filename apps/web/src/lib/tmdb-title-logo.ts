/** Keep in sync with `apps/server/src/lib/tmdb-title-logo.ts`. */

/** TMDb `/movie/{id}/images` logo row — title treatments for hero lockups. */
export type TmdbTitleLogoRow = {
	file_path: string;
	iso_639_1?: string | null;
	vote_average?: number;
	width?: number;
	height?: number;
};

/**
 * Pick the best horizontal title logo — English first, then language-neutral,
 * then highest community vote. Typical comp lockups use wide wordmarks.
 */
export function pickTitleLogoPath(
	logos: TmdbTitleLogoRow[] | null | undefined,
	preferLang = "en",
): string | null {
	if (!logos?.length) return null;

	const ranked = logos
		.filter((row) => row.file_path?.length)
		.map((row) => {
			const lang = row.iso_639_1 ?? null;
			let langScore = 0;
			if (lang === preferLang) langScore = 3;
			else if (lang == null) langScore = 2;
			else if (lang === "en") langScore = 1;

			const aspect =
				row.width && row.height && row.height > 0 ? row.width / row.height : 1;
			const aspectScore = aspect >= 1.25 ? 2 : aspect >= 0.85 ? 1 : 0;

			return {
				path: row.file_path,
				score: langScore * 100 + aspectScore * 10 + (row.vote_average ?? 0),
			};
		})
		.sort((a, b) => b.score - a.score);

	return ranked[0]?.path ?? null;
}

export function pickTitleLogoFromTmdbJson(
	tmdbJson: Record<string, unknown> | null | undefined,
	preferLang = "en",
): string | null {
	const logos = (tmdbJson?.images as { logos?: TmdbTitleLogoRow[] } | undefined)
		?.logos;
	return pickTitleLogoPath(logos, preferLang);
}
