/** Interactive trailer embed for listing detail (audible, with native player chrome). */
export function buildListingTrailerPlayerSrc(
	site: string | null | undefined,
	key: string,
	origin?: string,
): string | null {
	if (!key) return null;
	if (site === "Vimeo") {
		return `https://player.vimeo.com/video/${key}?autoplay=1&title=0&byline=0&portrait=0`;
	}
	const params = new URLSearchParams({
		autoplay: "1",
		rel: "0",
		modestbranding: "1",
		playsinline: "1",
		iv_load_policy: "3",
	});
	if (origin) params.set("origin", origin);
	return `https://www.youtube.com/embed/${key}?${params.toString()}`;
}
