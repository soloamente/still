import type { CompanionActivityMessage } from "./companion-message";
import { isCompanionActivityMessage } from "./companion-message";

/** Discord IPC opcodes. Handshake first, then JSON frames. Ping must be ponged. */
export const DISCORD_IPC_HANDSHAKE = 0;
export const DISCORD_IPC_FRAME = 1;
export const DISCORD_IPC_PING = 3;
export const DISCORD_IPC_PONG = 4;

/** Watching. Discord shows this as "Watching {name}". */
export const DISCORD_ACTIVITY_WATCHING = 3;

/** Keep a paused title briefly, then drop it so a paused tab does not sit on the profile. */
export const DISCORD_PAUSE_CLEAR_MS = 30_000;

/** Third line on the status. The Discord application name is also Sense. */
export const DISCORD_PRESENCE_BRAND = "Sense";

/**
 * Play and pause marks on the small image.
 * PNGs live in assets/ (inset glyph, not a full-bleed emoji). Discord's media
 * proxy cannot load localhost, so these are the public copies of those files.
 */
export const DISCORD_PLAY_IMAGE = "https://files.catbox.moe/yjkwtv.png";
export const DISCORD_PAUSE_IMAGE = "https://files.catbox.moe/bwuol4.png";

/** While paused, rewrite the bar about once a second so it stays on the pause point. */
export const DISCORD_PAUSE_TIMESTAMP_DRIFT_MS = 800;

export type DiscordFrame = {
	opcode: number;
	payload: unknown;
};

/** Spotify-style bar: start is where the title began, end is when it finishes. */
export type DiscordPlaybackTimestamps = {
	start: number;
	end: number;
};

export type DiscordPresenceDecision =
	| {
			action: "set";
			title: string;
			details: string | null;
			largeImage: string | null;
			largeText: string | null;
			smallImage: string | null;
			smallText: string | null;
			state: string | null;
			timestamps: DiscordPlaybackTimestamps | null;
			profileButtonUrl?: string | null;
	  }
	| { action: "hold" }
	| { action: "clear" };

/** Discord IPC wants milliseconds. The extension sends unix seconds. */
function toDiscordTimestampMs(value: number): number | null {
	if (!Number.isFinite(value) || value <= 0) return null;
	const ms = value < 100_000_000_000 ? value * 1000 : value;
	return Math.floor(ms);
}

/**
 * Both ends of the title, so Discord draws a bar instead of a clock that
 * started when the status appeared. A seek moves the window; steady playback does not.
 */
export function discordPlaybackTimestamps(input: {
	startTimestamp: number | null;
	endTimestamp: number | null;
	positionSec: number | null;
	durationSec: number | null;
	nowMs: number;
}): DiscordPlaybackTimestamps | null {
	const start = toDiscordTimestampMs(input.startTimestamp ?? 0);
	const end = toDiscordTimestampMs(input.endTimestamp ?? 0);
	if (start != null && end != null && end > start) return { start, end };
	const position = input.positionSec;
	const duration = input.durationSec;
	if (
		position == null ||
		duration == null ||
		!Number.isFinite(position) ||
		!Number.isFinite(duration) ||
		position < 0 ||
		duration <= 0
	) {
		return null;
	}
	const windowStart = Math.floor(input.nowMs - position * 1000);
	const windowEnd = Math.floor(windowStart + duration * 1000);
	if (windowEnd <= windowStart) return null;
	return { start: windowStart, end: windowEnd };
}

/** Ignore a one-second floor drift so playback ticks do not rewrite the bar. */
export function playbackTimestampsStable(
	previous: DiscordPlaybackTimestamps | null,
	next: DiscordPlaybackTimestamps | null,
	maxDriftMs = 3000,
): boolean {
	if (previous == null || next == null) return previous == null && next == null;
	return (
		Math.abs(previous.start - next.start) < maxDriftMs &&
		Math.abs(previous.end - next.end) < maxDriftMs
	);
}

export function encodeDiscordFrame(opcode: number, payload: unknown): Buffer {
	const json = Buffer.from(JSON.stringify(payload), "utf8");
	const header = Buffer.alloc(8);
	header.writeUInt32LE(opcode, 0);
	header.writeUInt32LE(json.length, 4);
	return Buffer.concat([header, json]);
}

/** Pull every complete frame out of a socket buffer. `rest` is the unfinished tail. */
export function decodeDiscordFrames(buffer: Buffer): {
	frames: DiscordFrame[];
	rest: Buffer;
} {
	const frames: DiscordFrame[] = [];
	let offset = 0;
	while (offset + 8 <= buffer.length) {
		const opcode = buffer.readUInt32LE(offset);
		const length = buffer.readUInt32LE(offset + 4);
		if (offset + 8 + length > buffer.length) break;
		const json = buffer
			.subarray(offset + 8, offset + 8 + length)
			.toString("utf8");
		frames.push({ opcode, payload: JSON.parse(json) as unknown });
		offset += 8 + length;
	}
	return { frames, rest: buffer.subarray(offset) };
}

export function discordArtworkUrl(
	value: string | null | undefined,
): string | null {
	if (!value || !value.startsWith("https://")) return null;
	try {
		const host = new URL(value).hostname.toLowerCase();
		// Those hosts are the upstream icon CDN. Sense only forwards title artwork.
		if (host === "cdn.rcd.gg" || host.endsWith(".rcd.gg")) return null;
	} catch {
		return null;
	}
	return value;
}

export function buildHandshake(clientId: string): {
	v: 1;
	client_id: string;
} {
	return { v: 1, client_id: clientId };
}

export function buildSetWatchingActivity(input: {
	pid: number;
	nonce: string;
	title: string;
	details: string | null;
	largeImage: string | null;
	largeText: string | null;
	smallImage: string | null;
	smallText: string | null;
	state: string | null;
	timestamps: DiscordPlaybackTimestamps | null;
	profileButtonUrl?: string | null;
}): {
	cmd: "SET_ACTIVITY";
	nonce: string;
	args: {
		pid: number;
		activity: {
			type: typeof DISCORD_ACTIVITY_WATCHING;
			name: string;
			state?: string;
			details?: string;
			assets?: {
				large_image?: string;
				large_text?: string;
				small_image?: string;
				small_text?: string;
			};
			timestamps?: DiscordPlaybackTimestamps;
			buttons?: Array<{ label: string; url: string }>;
		};
	};
} {
	const activity: {
		type: typeof DISCORD_ACTIVITY_WATCHING;
		name: string;
		state?: string;
		details?: string;
		assets?: {
			large_image?: string;
			large_text?: string;
			small_image?: string;
			small_text?: string;
		};
		timestamps?: DiscordPlaybackTimestamps;
		buttons?: Array<{ label: string; url: string }>;
	} = {
		type: DISCORD_ACTIVITY_WATCHING,
		name: input.title,
	};
	if (input.state) activity.state = input.state;
	if (input.details) activity.details = input.details;
	if (input.timestamps) activity.timestamps = input.timestamps;
	const assets: {
		large_image?: string;
		large_text?: string;
		small_image?: string;
		small_text?: string;
	} = {};
	if (input.largeImage) {
		assets.large_image = input.largeImage;
		if (input.largeText) assets.large_text = input.largeText;
	}
	if (input.smallImage) {
		assets.small_image = input.smallImage;
		if (input.smallText) assets.small_text = input.smallText;
	}
	if (input.largeImage || input.smallImage) activity.assets = assets;
	// Discord only accepts https button URLs. Local http profile links stay off.
	const buttonUrl = input.profileButtonUrl?.trim() ?? "";
	if (buttonUrl.startsWith("https://")) {
		activity.buttons = [{ label: "View profile", url: buttonUrl }];
	}
	return {
		cmd: "SET_ACTIVITY",
		nonce: input.nonce,
		args: { pid: input.pid, activity },
	};
}

export function buildClearActivity(input: { pid: number; nonce: string }): {
	cmd: "CLEAR_ACTIVITY";
	nonce: string;
	args: { pid: number };
} {
	return {
		cmd: "CLEAR_ACTIVITY",
		nonce: input.nonce,
		args: { pid: input.pid },
	};
}

function activityIsPaused(
	activity: Extract<
		CompanionActivityMessage,
		{ type: "sense-companion:activity" }
	>["activity"],
): boolean {
	const image = activity.smallImageKey ?? "";
	const label = activity.smallImageText ?? "";
	return image.endsWith("/pause.png") || label === "Paused";
}

function episodeMark(
	season: number | null,
	episode: number | null,
): string | null {
	if (season == null || episode == null) return null;
	if (!Number.isInteger(season) || !Number.isInteger(episode)) return null;
	if (season < 1 || episode < 1) return null;
	return `S${season} E${episode}`;
}

function filled(value: string | null | undefined): string | null {
	const trimmed = value?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : null;
}

function watchingCopy(
	message: Extract<
		CompanionActivityMessage,
		{ type: "sense-companion:activity" }
	>,
): {
	title: string;
	details: string | null;
	state: string | null;
	largeText: string | null;
	largeImage: string | null;
} | null {
	const title =
		message.senseMedia?.title.trim() ||
		message.activity.name?.trim() ||
		message.activity.details?.trim() ||
		"";
	if (!title) return null;
	const chosen = message.discordFields;
	const details = chosen
		? filled(chosen.details)
		: (episodeMark(
				message.senseMedia?.season ?? null,
				message.senseMedia?.episode ?? null,
			) ??
			(message.activity.largeImageText?.trim() &&
			message.activity.largeImageText.trim() !== title
				? message.activity.largeImageText.trim()
				: null));
	return {
		title: filled(chosen?.name) ?? title,
		details,
		state: chosen ? filled(chosen.state) : DISCORD_PRESENCE_BRAND,
		largeText: chosen ? filled(chosen.largeText) : title,
		largeImage: discordArtworkUrl(message.activity.largeImageKey),
	};
}

/** A title with a playback window, not a catalogue browse. */
function isPlayback(
	message: Extract<
		CompanionActivityMessage,
		{ type: "sense-companion:activity" }
	>,
): boolean {
	if (message.senseMedia) return true;
	const start = message.activity.startTimestamp;
	const end = message.activity.endTimestamp;
	return start != null && end != null && end > start;
}

/**
 * Map one extension message onto a Discord write.
 * Pause swaps the small image to the pause mark right away, and drops the
 * title after `DISCORD_PAUSE_CLEAR_MS` so a paused tab does not sit forever.
 */
export function decideDiscordPresence(input: {
	message: CompanionActivityMessage;
	now: number;
	pausedSince: number | null;
}): { decision: DiscordPresenceDecision; pausedSince: number | null } {
	if (input.message.type === "sense-companion:clear") {
		return { decision: { action: "clear" }, pausedSince: null };
	}

	const copy = watchingCopy(input.message);
	if (!copy) {
		return { decision: { action: "clear" }, pausedSince: null };
	}

	if (activityIsPaused(input.message.activity)) {
		const pausedSince = input.pausedSince ?? input.now;
		if (input.now - pausedSince >= DISCORD_PAUSE_CLEAR_MS) {
			return { decision: { action: "clear" }, pausedSince: null };
		}
		// Keep the movie bar, anchored to the paused position. Dropping the
		// timestamps makes Discord count elapsed time from the pause instead.
		return {
			decision: {
				action: "set",
				...copy,
				smallImage: DISCORD_PAUSE_IMAGE,
				smallText: "Paused",
				timestamps: discordPlaybackTimestamps({
					startTimestamp: null,
					endTimestamp: null,
					positionSec: input.message.senseMedia?.positionSec ?? null,
					durationSec: input.message.senseMedia?.durationSec ?? null,
					nowMs: input.now,
				}),
				profileButtonUrl: input.message.profileButtonUrl,
			},
			pausedSince,
		};
	}

	const playing = isPlayback(input.message);
	return {
		decision: {
			action: "set",
			...copy,
			smallImage: playing ? DISCORD_PLAY_IMAGE : null,
			smallText: playing ? "Playing" : null,
			timestamps: discordPlaybackTimestamps({
				startTimestamp: input.message.activity.startTimestamp,
				endTimestamp: input.message.activity.endTimestamp,
				positionSec: input.message.senseMedia?.positionSec ?? null,
				durationSec: input.message.senseMedia?.durationSec ?? null,
				nowMs: input.now,
			}),
			profileButtonUrl: input.message.profileButtonUrl,
		},
		pausedSince: null,
	};
}

const NATIVE_MESSAGE_MAX_BYTES = 1024 * 1024;

/** Chrome native messaging: 4-byte little-endian length, then JSON. */
export function encodeNativeMessage(payload: unknown): Buffer {
	const json = Buffer.from(JSON.stringify(payload), "utf8");
	if (json.length > NATIVE_MESSAGE_MAX_BYTES) {
		throw new Error("native message is larger than 1MB");
	}
	const header = Buffer.alloc(4);
	header.writeUInt32LE(json.length, 0);
	return Buffer.concat([header, json]);
}

export function readNativeMessagesFromBuffer(buffer: Buffer): {
	messages: unknown[];
	rest: Buffer;
} {
	const messages: unknown[] = [];
	let offset = 0;
	while (offset + 4 <= buffer.length) {
		const length = buffer.readUInt32LE(offset);
		if (length > NATIVE_MESSAGE_MAX_BYTES) {
			throw new Error("native message is larger than 1MB");
		}
		if (offset + 4 + length > buffer.length) break;
		const json = buffer
			.subarray(offset + 4, offset + 4 + length)
			.toString("utf8");
		messages.push(JSON.parse(json) as unknown);
		offset += 4 + length;
	}
	return { messages, rest: buffer.subarray(offset) };
}

/** Discord desktop listens on ipc-0 … ipc-9. */
export function discordIpcPipePath(
	index: number,
	platform: NodeJS.Platform,
): string {
	if (!Number.isInteger(index) || index < 0 || index > 9) {
		throw new Error(`Discord IPC index must be 0-9, got ${index}`);
	}
	if (platform === "win32") return `\\\\.\\pipe\\discord-ipc-${index}`;
	const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || "/tmp";
	return `${base.replace(/[/\\]+$/, "")}/discord-ipc-${index}`;
}

export function companionMessageFromNative(
	value: unknown,
): CompanionActivityMessage | null {
	if (!isCompanionActivityMessage(value)) return null;
	return value;
}
