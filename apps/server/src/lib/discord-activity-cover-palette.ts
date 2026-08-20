import { extractPosterPalette } from "./poster-palette";

/** In-memory cache — album art is stable for the length of a listening session. */
const COVER_ACCENT_CACHE = new Map<
	string,
	{ accent: string; expiresAtMs: number }
>();

const COVER_ACCENT_TTL_MS = 60 * 60 * 1000;
const COVER_ACCENT_CACHE_MAX = 200;

/**
 * Vibrant accent sampled from Discord activity artwork (album cover, game art).
 * Used for profile hero progress + ambient tint instead of fixed platform colors.
 */
export async function resolveDiscordActivityCoverAccent(
	imageUrl: string | null | undefined,
): Promise<string | null> {
	const url = imageUrl?.trim();
	if (!url) return null;

	const cached = COVER_ACCENT_CACHE.get(url);
	if (cached && cached.expiresAtMs > Date.now()) {
		return cached.accent;
	}

	const palette = await extractPosterPalette(url);
	const accent = palette?.accent?.trim() ?? null;
	if (!accent) return null;

	if (COVER_ACCENT_CACHE.size >= COVER_ACCENT_CACHE_MAX) {
		const oldestKey = COVER_ACCENT_CACHE.keys().next().value;
		if (oldestKey) COVER_ACCENT_CACHE.delete(oldestKey);
	}

	COVER_ACCENT_CACHE.set(url, {
		accent,
		expiresAtMs: Date.now() + COVER_ACCENT_TTL_MS,
	});

	return accent;
}
