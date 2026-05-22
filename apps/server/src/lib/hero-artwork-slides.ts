import { tmdbImg } from "./tmdb";

export type HeroArtworkSlide = {
	key: string;
	src: string;
	label: string;
};

export type TmdbImageRow = {
	file_path: string;
	vote_average?: number;
};

/** Coerce cached TMDb JSON `images` blobs to rows safe for hero carousel assembly. */
export function normalizeTmdbImagesBundle(
	raw:
		| {
				posters?: unknown[];
				backdrops?: unknown[];
		  }
		| null
		| undefined,
): { posters?: TmdbImageRow[]; backdrops?: TmdbImageRow[] } | null {
	if (!raw) return null;
	const isRow = (value: unknown): value is TmdbImageRow =>
		typeof value === "object" &&
		value != null &&
		typeof (value as TmdbImageRow).file_path === "string";
	const posters = Array.isArray(raw.posters)
		? raw.posters.filter(isRow)
		: undefined;
	const backdrops = Array.isArray(raw.backdrops)
		? raw.backdrops.filter(isRow)
		: undefined;
	if (!posters?.length && !backdrops?.length) return null;
	return { posters, backdrops };
}

const DEFAULT_MAX_SLIDES = 8;

function sortByVoteDesc(rows: TmdbImageRow[]): TmdbImageRow[] {
	return [...rows].sort(
		(a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
	);
}

/**
 * Build hero carousel slides from the primary poster plus TMDb `images.posters`
 * (appended on detail). Posters only — backdrops/scene stills are excluded so the
 * About hero matches marketing artwork. Dedupes by `file_path` and caps count.
 */
export function buildHeroArtworkSlides({
	title,
	posterPath,
	images,
	maxSlides = DEFAULT_MAX_SLIDES,
}: {
	title: string;
	posterPath: string | null;
	/** @deprecated Backdrops are not shown in the hero carousel; kept for call-site compatibility. */
	backdropPath?: string | null;
	images?: {
		posters?: TmdbImageRow[];
		backdrops?: TmdbImageRow[];
	} | null;
	maxSlides?: number;
}): HeroArtworkSlide[] {
	const seen = new Set<string>();
	const slides: HeroArtworkSlide[] = [];

	const pushPoster = (path: string, key: string, label: string) => {
		if (seen.has(path)) return;
		const src = tmdbImg.poster(path);
		if (!src) return;
		seen.add(path);
		slides.push({ key, src, label });
	};

	if (posterPath) {
		pushPoster(posterPath, "poster", `${title} poster`);
	}

	let posterIndex = 2;
	for (const row of sortByVoteDesc(images?.posters ?? [])) {
		if (slides.length >= maxSlides) break;
		if (!row.file_path || row.file_path === posterPath) continue;
		pushPoster(
			row.file_path,
			`poster-${posterIndex}`,
			`${title} poster ${posterIndex}`,
		);
		posterIndex += 1;
	}

	return slides;
}
