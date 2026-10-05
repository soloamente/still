/** Ignore trailers, ads, and short clips. Episodes and films clear this bar. */
export const GENERIC_VIDEO_MIN_DURATION_SEC = 8 * 60;

/** Corner players and muted bumpers stay below this width. */
export const GENERIC_VIDEO_MIN_WIDTH = 480;

const SUBDOMAIN_NOISE = new Set([
	"www",
	"m",
	"mobile",
	"play",
	"watch",
	"ww1",
	"ww2",
	"ww3",
]);

/** Hosts that already have a dedicated Sense Companion script. */
const DEDICATED_HOST =
	/(^|\.)netflix\.com$|(^|\.)disneyplus\.com$|(^|\.)hotstar\.com$|(^|\.)primevideo\.com$|(^|\.)amazon\.[a-z.]+$|^tv\.apple\.com$|^play\.hbomax\.com$|^play\.max\.com$|^(localhost|127\.0\.0\.1)$/i;

export type VideoCandidate = {
	paused: boolean;
	ended: boolean;
	currentTime: number;
	duration: number;
	videoWidth: number;
	videoHeight: number;
};

export function isDedicatedCompanionHost(hostname: string): boolean {
	return DEDICATED_HOST.test(hostname.trim());
}

/** `www.movy.sx` and `play.movy.sx` both read as Movy. */
export function serviceLabelFromHostname(hostname: string): string {
	const labels = hostname
		.toLowerCase()
		.replace(/\.$/, "")
		.split(".")
		.filter((label) => label.length > 0);
	const core = labels.filter(
		(label, index) => !(index === 0 && SUBDOMAIN_NOISE.has(label)),
	);
	const name = core[0] ?? "Web";
	return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Page titles on third-party players usually end with the site name.
 * Drop that suffix and a leading "Watch" so the diary match is the title.
 */
export function cleanWatchTitle(
	documentTitle: string,
	serviceLabel: string,
): string | null {
	let title = documentTitle.replace(/\s+/g, " ").trim();
	if (!title) return null;
	const service = serviceLabel.trim().toLowerCase();
	const parts = title.split(/\s+[-|–—•]\s+/).map((part) => part.trim());
	if (parts.length > 1) {
		const last = parts[parts.length - 1]?.toLowerCase() ?? "";
		if (
			service.length > 0 &&
			(last === service ||
				last.startsWith(`${service}.`) ||
				last.includes(service))
		) {
			title = parts.slice(0, -1).join(" - ").trim();
		}
	}
	title = title
		.replace(/^watch\s+/i, "")
		.replace(/\s+online free$/i, "")
		.trim();
	if (title.length < 2) return null;
	return title.slice(0, 180);
}

export function seasonEpisodeFromTitle(title: string): {
	kind: "movie" | "episode";
	season: number | null;
	episode: number | null;
} {
	const compact = title.match(/S(\d{1,3})\s*E(\d{1,4})/i);
	const words = title.match(/season\s+(\d{1,3})\s+episode\s+(\d{1,4})/i);
	const match = compact ?? words;
	if (!match) {
		return { kind: "movie", season: null, episode: null };
	}
	const season = Number(match[1]);
	const episode = Number(match[2]);
	if (season < 1 || episode < 1) {
		return { kind: "movie", season: null, episode: null };
	}
	return { kind: "episode", season, episode };
}

export function isWatchableVideo(video: VideoCandidate): boolean {
	if (video.ended) return false;
	if (!Number.isFinite(video.duration)) return false;
	if (video.duration < GENERIC_VIDEO_MIN_DURATION_SEC) return false;
	if (video.videoWidth < GENERIC_VIDEO_MIN_WIDTH) return false;
	if (video.currentTime <= 0 && video.paused) return false;
	return true;
}

/** Largest on-screen player wins when a page has more than one video. */
export function pickWatchableVideo<T extends VideoCandidate>(
	videos: readonly T[],
): T | null {
	const ready = videos.filter(isWatchableVideo);
	if (ready.length === 0) return null;
	return ready.reduce((best, next) => {
		const area = next.videoWidth * next.videoHeight;
		const bestArea = best.videoWidth * best.videoHeight;
		return area > bestArea ? next : best;
	});
}
