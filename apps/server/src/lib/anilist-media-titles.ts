import type { AnilistImportMedia } from "./anilist-import-json";
import { normalizeAnilistTitleObject } from "./anilist-import-json";

/**
 * Fetch canonical title variants from Anilist when a backup JSON is sparse
 * (e.g. only romaji userPreferred, missing english).
 */
export async function fetchAnilistMediaTitles(
	anilistId: number,
): Promise<AnilistImportMedia["title"] | null> {
	try {
		const res = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				query: `query ($id: Int) {
          Media(id: $id, type: ANIME) {
            title { userPreferred romaji english native }
          }
        }`,
				variables: { id: anilistId },
			}),
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) {
			console.warn(
				"[anilist-media-titles] GraphQL failed",
				anilistId,
				res.status,
			);
			return null;
		}
		const json = (await res.json()) as {
			data?: { Media?: { title?: unknown } | null };
		};
		const title = json.data?.Media?.title;
		if (!title) return null;
		return normalizeAnilistTitleObject(title);
	} catch (err) {
		console.warn("[anilist-media-titles] fetch failed", anilistId, err);
		return null;
	}
}

/** Fill missing title fields from a secondary source (Anilist API, MAL, etc.). */
export function mergeAnilistMediaTitles(
	base: AnilistImportMedia["title"],
	extra: AnilistImportMedia["title"],
): AnilistImportMedia["title"] {
	return {
		userPreferred:
			base.userPreferred?.trim() || extra.userPreferred?.trim() || null,
		english: base.english?.trim() || extra.english?.trim() || null,
		romaji: base.romaji?.trim() || extra.romaji?.trim() || null,
		native: base.native?.trim() || extra.native?.trim() || null,
	};
}
