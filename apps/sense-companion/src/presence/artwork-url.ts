function artworkArea(image: { w?: number; h?: number }): number {
	const width = typeof image.w === "number" ? image.w : 0;
	const height = typeof image.h === "number" ? image.h : 0;
	return width * height;
}

function isDirectPoster(url: string): boolean {
	const path = url.split("?")[0]?.toLowerCase() ?? "";
	return (
		path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png")
	);
}

/**
 * Pick a poster Discord's image proxy can fetch.
 * The first boxart is often a thumbnail. A huge or webp file comes back as
 * "unknown image", so stay with a jpeg or png at most 1600px on the long edge.
 */
export function largestArtworkUrl(
	images:
		| readonly { w?: number; h?: number; url?: string }[]
		| null
		| undefined,
): string | undefined {
	const posters: { area: number; url: string; direct: boolean }[] = [];
	for (const image of images ?? []) {
		if (typeof image.url !== "string" || !image.url.startsWith("https://")) {
			continue;
		}
		const width = typeof image.w === "number" ? image.w : 0;
		const height = typeof image.h === "number" ? image.h : 0;
		const longEdge = Math.max(width, height);
		if (longEdge > 1600) continue;
		posters.push({
			area: artworkArea(image),
			url: image.url,
			direct: isDirectPoster(image.url),
		});
	}
	const direct = posters.filter((poster) => poster.direct);
	const pool = direct.length > 0 ? direct : posters;
	let best: { area: number; url: string } | null = null;
	for (const poster of pool) {
		if (!best || poster.area > best.area) best = poster;
	}
	return best?.url;
}

function hostName(value: string): string | null {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return null;
	}
}

/**
 * Ask a few image hosts for a sharper file. Every other URL is returned
 * unchanged: rewriting `w` or re-encoding the query makes Discord show
 * "unknown image" because the proxy can no longer fetch the poster.
 */
export function upgradeArtworkUrl(
	value: string | null | undefined,
): string | null {
	if (!value || !value.startsWith("https://")) return null;
	const host = hostName(value);
	if (!host || host === "cdn.rcd.gg" || host.endsWith(".rcd.gg")) return null;

	if (host.endsWith("bamgrid.com")) {
		return value
			.replace(/([?&]format=)png/i, "$1jpeg")
			.replace(/([?&]width=)\d+/, "$1800");
	}

	if (host.endsWith("mzstatic.com")) {
		return value.replace(/\/\d+x\d+[a-z]{0,4}(?=\.)/i, "/800x800bb");
	}

	if (
		host.endsWith("media-amazon.com") ||
		host.endsWith("ssl-images-amazon.com")
	) {
		if (!/\._[A-Z]{2}\d/.test(value)) return value;
		return value.replace(/\._[^/]+(?=\.)/, "._SX800_");
	}

	if (host === "image.tmdb.org") {
		return value.replace(/\/w\d+\//, "/w780/");
	}

	return value;
}
