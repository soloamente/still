import type { SenseMedia } from "../presence/activity-log";
import {
	type CompanionLoggedNotice,
	readCompanionLoggedNotice,
} from "../presence/logged-notice";
import type { CompanionTokenStore } from "./client";

/** Position ticks stay local. Title, pause, and clear still go out immediately. */
export const COMPANION_HEARTBEAT_MIN_INTERVAL_MS = 5_000;

/** Same ratio as the server auto-log gate. Used to force one heartbeat in the last tenth. */
export const COMPANION_AUTO_LOG_RATIO = 0.9;
export const COMPANION_AUTO_LOG_MIN_DURATION_SEC = 10 * 60;

/** True when playhead is in the last tenth of a real runtime (mirrors server rules). */
export function companionMediaReadyToLog(media: SenseMedia): boolean {
	if (media.kind === "episode") {
		if (media.season == null || media.episode == null) return false;
		if (media.season < 1 || media.episode < 1) return false;
	}
	const position = media.positionSec;
	const duration = media.durationSec;
	if (position == null || duration == null) return false;
	if (!Number.isFinite(position) || !Number.isFinite(duration)) return false;
	if (duration < COMPANION_AUTO_LOG_MIN_DURATION_SEC) return false;
	if (position < 0 || position > duration + 30) return false;
	return position / duration >= COMPANION_AUTO_LOG_RATIO;
}

/** Asked of the offscreen page, which can reach Sense on this computer. */
export const COMPANION_HEARTBEAT_MESSAGE = "sense-companion:heartbeat";

type FetchLike = (
	input: string,
	init?: {
		method?: string;
		headers?: Record<string, string>;
		body?: string;
		targetAddressSpace?: "loopback";
	},
) => Promise<Response>;

export function companionHeartbeatKey(input: {
	clear: boolean;
	media: SenseMedia | null;
	paused: boolean;
}): string | null {
	if (input.clear || !input.media) return null;
	const media = input.media;
	return `${media.provider}|${media.kind}|${media.title.trim().toLowerCase()}|${media.season}|${media.episode}|${input.paused}`;
}

export function shouldSendCompanionHeartbeat(input: {
	now: number;
	lastSentAt: number | null;
	lastKey: string | null;
	nextKey: string | null;
	minIntervalMs: number;
}): boolean {
	if (input.nextKey !== input.lastKey) return true;
	if (input.lastSentAt === null) return true;
	return input.now - input.lastSentAt >= input.minIntervalMs;
}

/** Heartbeat for the paired device. No token means the popup has not paired yet. */
export async function postCompanionNowWatching(input: {
	origin: string;
	store: CompanionTokenStore;
	media: SenseMedia | null;
	paused: boolean;
	clear?: boolean;
	fetchImpl?: FetchLike;
}): Promise<{
	status: "sent" | "skipped" | "unauthorized" | "unreachable";
	logged: CompanionLoggedNotice | null;
	titleUrl: string | null;
}> {
	const token = await input.store.get();
	if (!token) return { status: "skipped", logged: null, titleUrl: null };
	const fetchImpl = input.fetchImpl ?? fetch;
	const body = input.clear
		? { clear: true }
		: { paused: input.paused, media: input.media };
	try {
		const response = await fetchImpl(
			`${input.origin}/api/companion/now-watching`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(body),
				// Tells Chrome this call stays on this computer, so it is not blocked
				// as a local-network request.
				targetAddressSpace: "loopback",
			},
		);
		if (!response.ok) {
			const detail = await response.text().catch(() => "");
			console.error(
				"Sense Companion heartbeat failed",
				response.status,
				detail.slice(0, 180),
			);
			if (response.status === 401) {
				return { status: "unauthorized", logged: null, titleUrl: null };
			}
			return { status: "unreachable", logged: null, titleUrl: null };
		}
		let logged: CompanionLoggedNotice | null = null;
		let titleUrl: string | null = null;
		try {
			const payload = (await response.json()) as unknown;
			logged = readCompanionLoggedNotice({
				type: "sense-companion:logged",
				...readLoggedFields(payload),
			});
			titleUrl = readTitleUrl(payload);
		} catch (error) {
			console.error("Sense Companion log notice failed", error);
		}
		return { status: "sent", logged, titleUrl };
	} catch (error) {
		console.error("Sense Companion heartbeat failed", error);
		return { status: "unreachable", logged: null, titleUrl: null };
	}
}

function readTitleUrl(body: unknown): string | null {
	if (typeof body !== "object" || body === null) return null;
	const titleUrl = (body as { titleUrl?: unknown }).titleUrl;
	if (typeof titleUrl !== "string" || !titleUrl.startsWith("https://")) {
		return null;
	}
	return titleUrl;
}

/** The API nests the diary row under `logged`. The toast reader wants those fields flat. */
function readLoggedFields(body: unknown): {
	logId?: unknown;
	title?: unknown;
	kind?: unknown;
	season?: unknown;
	episode?: unknown;
	seriesFinale?: unknown;
} {
	if (typeof body !== "object" || body === null) return {};
	const logged = (body as { logged?: unknown }).logged;
	if (typeof logged !== "object" || logged === null) return {};
	return logged as {
		logId?: unknown;
		title?: unknown;
		kind?: unknown;
		season?: unknown;
		episode?: unknown;
		seriesFinale?: unknown;
	};
}
