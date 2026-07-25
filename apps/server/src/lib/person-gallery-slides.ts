import { tmdbImg } from "./tmdb";

export type PersonGallerySlide = {
	key: string;
	src: string;
	srcFull?: string | null;
	label: string;
	/** Drives per-slide card aspect on the person stills rail. */
	aspectRatio: number;
};

/** TMDb profile / poster default (~2:3). */
const PROFILE_ASPECT = 2 / 3;
/** Widescreen fallback when tagged stills omit aspect_ratio. */
const LANDSCAPE_ASPECT = 16 / 9;

export type TmdbPersonTaggedImageRow = {
	file_path: string;
	aspect_ratio?: number;
	vote_average?: number;
	image_type?: string;
	media?: {
		title?: string | null;
		name?: string | null;
	} | null;
};

export type TmdbPersonProfileImageRow = {
	file_path: string;
	vote_average?: number;
	aspect_ratio?: number;
};

const DEFAULT_MAX_SLIDES = 24;

/** Prefer widescreen / backdrop-like frames for the editorial stills rail. */
function isLandscapeTagged(row: TmdbPersonTaggedImageRow): boolean {
	if (row.image_type === "backdrop") return true;
	if (typeof row.aspect_ratio === "number" && row.aspect_ratio >= 1.2) {
		return true;
	}
	return false;
}

function sortByVoteDesc<T extends { vote_average?: number }>(rows: T[]): T[] {
	return [...rows].sort(
		(a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
	);
}

function mediaTitleFromTagged(row: TmdbPersonTaggedImageRow): string | null {
	const title = row.media?.title?.trim() || row.media?.name?.trim();
	return title || null;
}

/**
 * About-tab gallery for person detail: TMDb tagged stills from films/TV first,
 * then extra profile headshots (excluding the hero portrait).
 */
export function buildPersonGallerySlides({
	personName,
	heroProfilePath,
	taggedImages = [],
	profiles = [],
	maxSlides = DEFAULT_MAX_SLIDES,
}: {
	personName: string;
	heroProfilePath: string | null;
	taggedImages?: TmdbPersonTaggedImageRow[];
	profiles?: TmdbPersonProfileImageRow[];
	maxSlides?: number;
}): PersonGallerySlide[] {
	const seen = new Set<string>();
	const slides: PersonGallerySlide[] = [];

	const pushBackdrop = (
		path: string,
		key: string,
		label: string,
		aspectRatio: number,
	) => {
		if (seen.has(path) || slides.length >= maxSlides) return;
		const src = tmdbImg.backdrop(path, "w1280");
		if (!src) return;
		seen.add(path);
		slides.push({
			key,
			src,
			srcFull: tmdbImg.backdrop(path, "original"),
			label,
			aspectRatio,
		});
	};

	const pushProfile = (
		path: string,
		key: string,
		label: string,
		aspectRatio: number,
	) => {
		if (seen.has(path) || slides.length >= maxSlides) return;
		if (heroProfilePath && path === heroProfilePath) return;
		const src = tmdbImg.profile(path, "h632");
		if (!src) return;
		seen.add(path);
		slides.push({
			key,
			src,
			srcFull: tmdbImg.profile(path, "original"),
			label,
			aspectRatio,
		});
	};

	const taggedSorted = sortByVoteDesc(taggedImages);
	// Landscape / backdrop tags first so the rail matches movie stills framing.
	const landscape = taggedSorted.filter(isLandscapeTagged);
	const portraitTagged = taggedSorted.filter((row) => !isLandscapeTagged(row));

	let stillIndex = 1;
	for (const row of [...landscape, ...portraitTagged]) {
		if (!row.file_path) continue;
		const before = slides.length;
		const mediaTitle = mediaTitleFromTagged(row);
		const label = mediaTitle
			? `${personName} in ${mediaTitle}`
			: `${personName} still ${stillIndex}`;
		const aspectRatio =
			typeof row.aspect_ratio === "number" &&
			Number.isFinite(row.aspect_ratio) &&
			row.aspect_ratio > 0
				? row.aspect_ratio
				: isLandscapeTagged(row)
					? LANDSCAPE_ASPECT
					: PROFILE_ASPECT;
		// Tagged media paths are served from the same CDN sizes as backdrops.
		pushBackdrop(row.file_path, `tagged-${stillIndex}`, label, aspectRatio);
		if (slides.length > before) stillIndex += 1;
	}

	let profileIndex = 1;
	for (const row of sortByVoteDesc(profiles)) {
		if (!row.file_path) continue;
		const before = slides.length;
		const aspectRatio =
			typeof row.aspect_ratio === "number" &&
			Number.isFinite(row.aspect_ratio) &&
			row.aspect_ratio > 0
				? row.aspect_ratio
				: PROFILE_ASPECT;
		pushProfile(
			row.file_path,
			`profile-${profileIndex}`,
			`${personName} portrait ${profileIndex}`,
			aspectRatio,
		);
		if (slides.length > before) profileIndex += 1;
	}

	return slides;
}
