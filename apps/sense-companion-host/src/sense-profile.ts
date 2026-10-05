import type { CompanionActivityMessage, SenseMedia } from "./companion-message";

/**
 * Elysia on this PC. Heartbeats go straight to the API so the Next `/api`
 * rewrite cannot drop the POST body on the way through port 3001.
 */
export const SENSE_PROFILE_ORIGIN = "http://127.0.0.1:3000";

/** Match the extension: title changes go immediately, position ticks wait. */
export const SENSE_PROFILE_MIN_INTERVAL_MS = 5_000;

type FetchLike = (
	input: string,
	init?: {
		method?: string;
		headers?: Record<string, string>;
		body?: string;
	},
) => Promise<{
	ok: boolean;
	status: number;
	json?: () => Promise<unknown>;
}>;

export type SenseLoggedNotice = {
	logId: string;
	title: string;
	kind: "movie" | "tv";
	season: number | null;
	episode: number | null;
	seriesFinale: boolean;
};

export type SenseProfileSave =
	| { status: "skipped" }
	| { status: "failed" }
	| { status: "sent"; logged: SenseLoggedNotice | null };

function readCount(value: unknown): number | null {
	if (value == null) return null;
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: null;
}

/** The API sets this once, when a diary row was just written. */
export function readLoggedNotice(value: unknown): SenseLoggedNotice | null {
	if (typeof value !== "object" || value === null) return null;
	const logged = (value as { logged?: unknown }).logged;
	if (typeof logged !== "object" || logged === null) return null;
	const notice = logged as {
		logId?: unknown;
		title?: unknown;
		kind?: unknown;
		season?: unknown;
		episode?: unknown;
		seriesFinale?: unknown;
	};
	if (typeof notice.logId !== "string" || notice.logId.length === 0)
		return null;
	if (typeof notice.title !== "string" || notice.title.length === 0)
		return null;
	if (notice.kind !== "movie" && notice.kind !== "tv") return null;
	return {
		logId: notice.logId,
		title: notice.title,
		kind: notice.kind,
		season: readCount(notice.season),
		episode: readCount(notice.episode),
		seriesFinale: notice.seriesFinale === true,
	};
}

export function readProfileToken(value: unknown): string | null {
	if (typeof value !== "object" || value === null) return null;
	const token = (value as { profileToken?: unknown }).profileToken;
	return typeof token === "string" && token.length > 0 ? token : null;
}

function isPaused(
	message: Extract<
		CompanionActivityMessage,
		{ type: "sense-companion:activity" }
	>,
): boolean {
	const image = message.activity.smallImageKey ?? "";
	const label = message.activity.smallImageText ?? "";
	return image.endsWith("/pause.png") || label === "Paused";
}

/** What Sense should store for one playback message. */
export function senseProfileBody(
	message: CompanionActivityMessage,
): { clear: true } | { paused: boolean; media: SenseMedia } {
	if (message.type === "sense-companion:clear" || !message.senseMedia) {
		return { clear: true };
	}
	return { paused: isPaused(message), media: message.senseMedia };
}

export function senseProfileKey(message: CompanionActivityMessage): string {
	const body = senseProfileBody(message);
	if ("clear" in body) return "clear";
	const media = body.media;
	return `${media.provider}|${media.kind}|${media.title}|${media.season}|${media.episode}|${body.paused}`;
}

export function shouldSendSenseProfile(input: {
	now: number;
	lastSentAt: number | null;
	lastKey: string | null;
	nextKey: string;
	minIntervalMs: number;
}): boolean {
	if (input.nextKey !== input.lastKey) return true;
	if (input.lastSentAt === null) return true;
	return input.now - input.lastSentAt >= input.minIntervalMs;
}

/** Save the title on the Sense profile. A missing token means this browser is not paired. */
export async function postSenseProfile(input: {
	origin: string;
	token: string | null;
	message: CompanionActivityMessage;
	fetchImpl?: FetchLike;
}): Promise<SenseProfileSave> {
	if (!input.token) return { status: "skipped" };
	const fetchImpl = input.fetchImpl ?? fetch;
	try {
		const response = await fetchImpl(
			`${input.origin}/api/companion/now-watching`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${input.token}`,
				},
				body: JSON.stringify(senseProfileBody(input.message)),
			},
		);
		if (!response.ok) {
			console.error("Sense Companion profile save failed", response.status);
			return { status: "failed" };
		}
		let logged: SenseLoggedNotice | null = null;
		if (response.json) {
			try {
				logged = readLoggedNotice(await response.json());
			} catch (error) {
				console.error("Sense Companion log notice failed", error);
			}
		}
		return { status: "sent", logged };
	} catch (error) {
		console.error("Sense Companion profile save failed", error);
		return { status: "failed" };
	}
}
