/** Background embed URL for taste-hero lobby trailers (YouTube or Vimeo). */
export function buildTasteHeroTrailerBackgroundSrc(
	site: string | null | undefined,
	key: string,
	origin?: string,
): string | null {
	if (!key) return null;
	if (site === "Vimeo") {
		return `https://player.vimeo.com/video/${key}?background=1&autoplay=1&muted=1&loop=1&badge=0&byline=0&title=0`;
	}
	const params = new URLSearchParams({
		autoplay: "1",
		mute: "1",
		controls: "0",
		rel: "0",
		modestbranding: "1",
		playsinline: "1",
		loop: "1",
		playlist: key,
		iv_load_policy: "3",
		disablekb: "1",
		enablejsapi: "1",
	});
	if (origin) params.set("origin", origin);
	return `https://www.youtube.com/embed/${key}?${params.toString()}`;
}
