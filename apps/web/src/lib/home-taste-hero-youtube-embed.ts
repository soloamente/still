/** Parse a taste-hero YouTube embed URL into video id + optional origin. */
export function parseTasteHeroYouTubeEmbed(src: string): {
	videoId: string;
	origin: string | null;
} | null {
	const match =
		/(?:youtube\.com|youtube-nocookie\.com)\/embed\/([^?&#/]+)/i.exec(src);
	const videoId = match?.[1]?.trim();
	if (!videoId) return null;

	try {
		const origin = new URL(src).searchParams.get("origin");
		return { videoId, origin: origin && origin.length > 0 ? origin : null };
	} catch {
		return { videoId, origin: null };
	}
}

/**
 * YouTube IFrame `onError` codes that mean the embed cannot play here
 * (age gate, embedding disabled, missing, HTML5 failure). Fall back to backdrop.
 * @see https://developers.google.com/youtube/iframe_api_reference#onError
 */
export function isYouTubeEmbedPlaybackBlocked(errorCode: number): boolean {
	return (
		errorCode === 2 ||
		errorCode === 5 ||
		errorCode === 100 ||
		errorCode === 101 ||
		errorCode === 150 ||
		errorCode === 153
	);
}
