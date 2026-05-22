import { env } from "@still/env/web";

/** Stable cache-bust param for cover proxy URLs (API may return `Date` or ISO string). */
function listCoverCacheParam(cacheKey?: string | number): string | undefined {
	if (cacheKey == null) return undefined;
	if (typeof cacheKey === "number" && Number.isFinite(cacheKey)) {
		return String(cacheKey);
	}
	const parsed = Date.parse(String(cacheKey));
	if (Number.isFinite(parsed)) return String(parsed);
	return String(cacheKey);
}

/**
 * Proxied cover art for list tiles and hero — private Vercel Blob URLs are not
 * fetchable by the browser or Next `<Image>` optimization (`403`).
 */
export function listCoverImageProxyUrl(
	listId: string,
	cacheKey?: string | number,
): string {
	const url = new URL(
		`/api/lists/${encodeURIComponent(listId)}/cover-image`,
		env.NEXT_PUBLIC_SERVER_URL,
	);
	const v = listCoverCacheParam(cacheKey);
	if (v) url.searchParams.set("v", v);
	return url.href;
}

/**
 * Dev/prod: Next `<Image>` must not optimize API proxy URLs (localhost resolves as private IP).
 */
export function isListCoverProxySrc(src: string): boolean {
	try {
		const origin = new URL(env.NEXT_PUBLIC_SERVER_URL).origin;
		return (
			src.startsWith(origin) &&
			src.includes("/api/lists/") &&
			src.includes("/cover-image")
		);
	} catch {
		return src.includes("/api/lists/") && src.includes("/cover-image");
	}
}

/** Browser- and Next-safe `src` when the list has a custom uploaded cover. */
export function resolveListCoverImageSrc(
	listId: string,
	coverImageUrl: string | null | undefined,
	cacheKey?: string | number,
): string | null {
	if (!coverImageUrl?.trim()) return null;
	if (coverImageUrl.includes("blob.vercel-storage.com")) {
		return listCoverImageProxyUrl(listId, cacheKey);
	}
	return coverImageUrl;
}
