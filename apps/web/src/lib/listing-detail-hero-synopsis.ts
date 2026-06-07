const DEFAULT_HERO_SYNOPSIS_MAX_LENGTH = 280;

export type ListingDetailHeroSynopsis = {
	full: string;
	preview: string;
	isTruncated: boolean;
};

/** Hero synopsis under title — TMDb overview, not the marketing tagline. */
export function resolveListingDetailHeroSynopsis(
	overview: string | null | undefined,
	maxLength = DEFAULT_HERO_SYNOPSIS_MAX_LENGTH,
): ListingDetailHeroSynopsis | null {
	const text = overview?.trim();
	if (!text) return null;
	if (text.length <= maxLength) {
		return { full: text, preview: text, isTruncated: false };
	}
	return {
		full: text,
		preview: `${text.slice(0, maxLength - 3)}…`,
		isTruncated: true,
	};
}

/** Truncated preview for metadata and non-interactive surfaces. */
export function listingDetailHeroSynopsisBlurb(
	overview: string | null | undefined,
	maxLength = DEFAULT_HERO_SYNOPSIS_MAX_LENGTH,
): string | null {
	return resolveListingDetailHeroSynopsis(overview, maxLength)?.preview ?? null;
}
