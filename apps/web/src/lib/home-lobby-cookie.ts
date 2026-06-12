/**
 * Cookie mirror of the last `/home?…` lobby URL so RSC can restore chips on a bare
 * `/home` visit without `redirect()` (avoids dev/prod 307 churn on every Home nav).
 */

export const HOME_LOBBY_HREF_COOKIE = "still.home-lobby-href-v1";

export type HomeLobbySearchParams = {
	browse?: string;
	sort?: string;
	venue?: string;
	run?: string;
	/** TV seasonal anime slice (`?animeSeason=1`, SN.17.2). */
	animeSeason?: string;
	/** Leaderboard window when community sort is `ranks`. */
	period?: string;
	genre?: string;
	monetization?: string;
};

/** Parses the saved href cookie into lobby query fields (server + client). */
export function parseHomeLobbyHrefCookie(
	raw: string | undefined | null,
): HomeLobbySearchParams | null {
	if (!raw) return null;
	try {
		const decoded = decodeURIComponent(raw.trim());
		const url = new URL(decoded, "http://still.local");
		if (url.pathname !== "/home") return null;
		const hasAny =
			url.searchParams.has("browse") ||
			url.searchParams.has("sort") ||
			url.searchParams.has("venue") ||
			url.searchParams.has("run") ||
			url.searchParams.has("animeSeason") ||
			url.searchParams.has("period") ||
			url.searchParams.has("genre") ||
			url.searchParams.has("monetization");
		if (!hasAny) return null;
		return {
			browse: url.searchParams.get("browse") ?? undefined,
			sort: url.searchParams.get("sort") ?? undefined,
			venue: url.searchParams.get("venue") ?? undefined,
			run: url.searchParams.get("run") ?? undefined,
			animeSeason: url.searchParams.get("animeSeason") ?? undefined,
			period: url.searchParams.get("period") ?? undefined,
			genre: url.searchParams.get("genre") ?? undefined,
			monetization: url.searchParams.get("monetization") ?? undefined,
		};
	} catch {
		return null;
	}
}

/** Client-only — keeps the cookie aligned with {@link mergePersistFromHomeUrl}. */
export function writeHomeLobbyHrefCookie(href: string): void {
	if (typeof document === "undefined") return;
	if (!href.startsWith("/home")) return;
	try {
		const encoded = encodeURIComponent(href);
		document.cookie = `${HOME_LOBBY_HREF_COOKIE}=${encoded}; path=/; max-age=31536000; samesite=lax`;
	} catch {
		// Private mode / quota — localStorage restore still works client-side.
	}
}

export function isBareHomeLobbySearchParams(
	sp: HomeLobbySearchParams,
): boolean {
	return (
		!sp.browse &&
		!sp.sort &&
		!sp.venue &&
		!sp.run &&
		!sp.animeSeason &&
		!sp.period &&
		!sp.genre &&
		!sp.monetization
	);
}
