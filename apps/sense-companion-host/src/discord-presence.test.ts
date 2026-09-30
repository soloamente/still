import { describe, expect, test } from "bun:test";
import type { CompanionActivityMessage } from "./companion-message";
import {
	buildClearActivity,
	buildHandshake,
	buildSetWatchingActivity,
	DISCORD_IPC_FRAME,
	DISCORD_IPC_HANDSHAKE,
	DISCORD_IPC_PONG,
	DISCORD_PAUSE_CLEAR_MS,
	DISCORD_PAUSE_IMAGE,
	DISCORD_PLAY_IMAGE,
	decideDiscordPresence,
	decodeDiscordFrames,
	discordIpcPipePath,
	discordPlaybackTimestamps,
	encodeDiscordFrame,
	encodeNativeMessage,
	playbackTimestampsStable,
	readNativeMessagesFromBuffer,
} from "./discord-presence";

const STRANGER: CompanionActivityMessage = {
	type: "sense-companion:activity",
	service: "Netflix",
	activity: {
		details: "Chapter One",
		state: null,
		largeImageText: "Season 4, Episode 1",
		smallImageKey: null,
		smallImageText: null,
		startTimestamp: 1_700_000_000,
		endTimestamp: 1_700_003_600,
		name: "Stranger Things",
		type: 3,
	},
	senseMedia: {
		provider: "netflix",
		kind: "episode",
		title: "Stranger Things",
		season: 4,
		episode: 1,
		positionSec: 30,
		durationSec: 3600,
	},
};

describe("Discord IPC frames", () => {
	test("handshake carries the Sense application id", () => {
		const frame = encodeDiscordFrame(
			DISCORD_IPC_HANDSHAKE,
			buildHandshake("123456789012345678"),
		);
		const decoded = decodeDiscordFrames(frame);
		expect(decoded.frames).toEqual([
			{
				opcode: DISCORD_IPC_HANDSHAKE,
				payload: { v: 1, client_id: "123456789012345678" },
			},
		]);
		expect(decoded.rest.length).toBe(0);
	});

	test("Watching Stranger Things is type 3 with Sense on the status", () => {
		const frame = encodeDiscordFrame(
			DISCORD_IPC_FRAME,
			buildSetWatchingActivity({
				pid: 42,
				nonce: "n1",
				title: "Stranger Things",
				details: "S4 E1",
				largeImage: null,
				largeText: null,
				smallImage: null,
				smallText: null,
				state: "Sense",
				timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
			}),
		);
		const decoded = decodeDiscordFrames(frame);
		expect(decoded.frames[0]).toEqual({
			opcode: DISCORD_IPC_FRAME,
			payload: {
				cmd: "SET_ACTIVITY",
				nonce: "n1",
				args: {
					pid: 42,
					activity: {
						type: 3,
						name: "Stranger Things",
						details: "S4 E1",
						state: "Sense",
						timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
					},
				},
			},
		});
	});

	test("an https profile URL becomes a View profile button", () => {
		const withHttps = buildSetWatchingActivity({
			pid: 42,
			nonce: "n1",
			title: "Stranger Things",
			details: "S4 E1",
			largeImage: null,
			largeText: null,
			smallImage: null,
			smallText: null,
			state: "Sense",
			timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
			profileButtonUrl: "https://sense.example/profile/ada",
		});
		expect(withHttps.args.activity.buttons).toEqual([
			{ label: "View profile", url: "https://sense.example/profile/ada" },
		]);

		const withHttp = buildSetWatchingActivity({
			pid: 42,
			nonce: "n1",
			title: "Stranger Things",
			details: "S4 E1",
			largeImage: null,
			largeText: null,
			smallImage: null,
			smallText: null,
			state: "Sense",
			timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
			profileButtonUrl: "http://127.0.0.1:3001/profile/ada",
		});
		expect(withHttp.args.activity).not.toHaveProperty("buttons");
	});

	test("the small image is the play mark with a Playing tooltip", () => {
		const decoded = decodeDiscordFrames(
			encodeDiscordFrame(
				DISCORD_IPC_FRAME,
				buildSetWatchingActivity({
					pid: 42,
					nonce: "n-play",
					title: "Am I OK?",
					details: null,
					largeImage: "https://image.tmdb.org/poster.jpg",
					largeText: "Am I OK?",
					smallImage: DISCORD_PLAY_IMAGE,
					smallText: "Playing",
					state: null,
					timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
				}),
			),
		);
		expect(decoded.frames[0]?.payload).toMatchObject({
			args: {
				activity: {
					assets: {
						large_image: "https://image.tmdb.org/poster.jpg",
						large_text: "Am I OK?",
						small_image: DISCORD_PLAY_IMAGE,
						small_text: "Playing",
					},
				},
			},
		});
	});

	test("clear uses CLEAR_ACTIVITY", () => {
		const decoded = decodeDiscordFrames(
			encodeDiscordFrame(
				DISCORD_IPC_FRAME,
				buildClearActivity({ pid: 42, nonce: "n2" }),
			),
		);
		expect(decoded.frames[0]?.payload).toEqual({
			cmd: "CLEAR_ACTIVITY",
			nonce: "n2",
			args: { pid: 42 },
		});
	});

	test("a split frame waits for the rest of the body", () => {
		const frame = encodeDiscordFrame(DISCORD_IPC_PONG, { nonce: "ping" });
		const head = frame.subarray(0, 6);
		const tail = frame.subarray(6);
		const partial = decodeDiscordFrames(head);
		expect(partial.frames).toEqual([]);
		const done = decodeDiscordFrames(Buffer.concat([partial.rest, tail]));
		expect(done.frames[0]).toEqual({
			opcode: DISCORD_IPC_PONG,
			payload: { nonce: "ping" },
		});
	});
});

describe("decideDiscordPresence", () => {
	test("title artwork is sent and the upstream icon CDN is not", () => {
		const message: CompanionActivityMessage = {
			...STRANGER,
			activity: {
				...STRANGER.activity,
				largeImageKey: "https://occ.nflxso.net/boxart.jpg",
				smallImageKey: "https://cdn.rcd.gg/PreMiD/resources/play.png",
			},
		};
		const result = decideDiscordPresence({
			message,
			now: 1_000,
			pausedSince: null,
		});
		expect(result.decision).toEqual({
			action: "set",
			title: "Stranger Things",
			details: "S4 E1",
			largeImage: "https://occ.nflxso.net/boxart.jpg",
			largeText: "Stranger Things",
			smallImage: DISCORD_PLAY_IMAGE,
			smallText: "Playing",
			state: "Sense",
			timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
		});
	});

	test("playback sets Watching Stranger Things", () => {
		const result = decideDiscordPresence({
			message: STRANGER,
			now: 1_000,
			pausedSince: null,
		});
		expect(result.pausedSince).toBeNull();
		expect(result.decision).toEqual({
			action: "set",
			title: "Stranger Things",
			details: "S4 E1",
			largeImage: null,
			largeText: "Stranger Things",
			smallImage: DISCORD_PLAY_IMAGE,
			smallText: "Playing",
			state: "Sense",
			timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
		});
	});

	test("the bar is the movie, from where you are to the end", () => {
		expect(
			discordPlaybackTimestamps({
				startTimestamp: 1_700_000_000,
				endTimestamp: 1_700_003_600,
				positionSec: null,
				durationSec: null,
				nowMs: 1_700_000_030_000,
			}),
		).toEqual({ start: 1_700_000_000_000, end: 1_700_003_600_000 });
		expect(
			discordPlaybackTimestamps({
				startTimestamp: null,
				endTimestamp: null,
				positionSec: 30,
				durationSec: 3600,
				nowMs: 1_700_000_030_000,
			}),
		).toEqual({ start: 1_700_000_000_000, end: 1_700_003_600_000 });
		expect(
			playbackTimestampsStable(
				{ start: 1_000, end: 5_000 },
				{ start: 1_500, end: 5_400 },
			),
		).toBe(true);
		expect(
			playbackTimestampsStable(
				{ start: 1_000, end: 5_000 },
				{ start: 20_000, end: 24_000 },
			),
		).toBe(false);
	});

	test("a short pause keeps the bar frozen on the paused minute", () => {
		const paused = {
			...STRANGER,
			activity: {
				...STRANGER.activity,
				startTimestamp: null,
				endTimestamp: null,
				smallImageKey: "https://cdn.rcd.gg/PreMiD/resources/pause.png",
				smallImageText: "Paused",
			},
		};
		const result = decideDiscordPresence({
			message: paused,
			now: 1_700_000_030_000,
			pausedSince: 1_700_000_020_000,
		});
		expect(result.decision).toEqual({
			action: "set",
			title: "Stranger Things",
			details: "S4 E1",
			largeImage: null,
			largeText: "Stranger Things",
			smallImage: DISCORD_PAUSE_IMAGE,
			smallText: "Paused",
			state: "Sense",
			timestamps: { start: 1_700_000_000_000, end: 1_700_003_600_000 },
		});
		expect(result.pausedSince).toBe(1_700_000_020_000);
		const later = decideDiscordPresence({
			message: paused,
			now: 1_700_000_031_000,
			pausedSince: 1_700_000_020_000,
		});
		expect(later.decision).toMatchObject({
			timestamps: { start: 1_700_000_001_000, end: 1_700_003_601_000 },
		});
		expect(
			playbackTimestampsStable(
				{ start: 1_700_000_000_000, end: 1_700_003_600_000 },
				{ start: 1_700_000_001_000, end: 1_700_003_601_000 },
				800,
			),
		).toBe(false);
	});

	test("pause clears after the timeout", () => {
		const paused = {
			...STRANGER,
			activity: {
				...STRANGER.activity,
				smallImageKey: "https://cdn.example/pause.png",
			},
		};
		const result = decideDiscordPresence({
			message: paused,
			now: 1_000 + DISCORD_PAUSE_CLEAR_MS,
			pausedSince: 1_000,
		});
		expect(result.decision).toEqual({ action: "clear" });
		expect(result.pausedSince).toBeNull();
	});

	test("a saved layout replaces the title, the lines, and the cover tooltip", () => {
		const result = decideDiscordPresence({
			message: {
				...STRANGER,
				discordFields: {
					name: "Netflix",
					details: "Chapter One",
					state: null,
					largeText: "S4 E1",
				},
			},
			now: 1_000,
			pausedSince: null,
		});
		expect(result.decision).toMatchObject({
			action: "set",
			title: "Netflix",
			details: "Chapter One",
			state: null,
			largeText: "S4 E1",
		});
	});

	test("tab close clears immediately", () => {
		const result = decideDiscordPresence({
			message: { type: "sense-companion:clear", service: "Netflix" },
			now: 2_000,
			pausedSince: 1_000,
		});
		expect(result.decision).toEqual({ action: "clear" });
		expect(result.pausedSince).toBeNull();
	});
});

describe("native messaging", () => {
	test("round-trips one Chrome native message", () => {
		const encoded = encodeNativeMessage({
			type: "sense-companion:clear",
			service: "Netflix",
		});
		const read = readNativeMessagesFromBuffer(encoded);
		expect(read.messages).toEqual([
			{ type: "sense-companion:clear", service: "Netflix" },
		]);
		expect(read.rest.length).toBe(0);
	});
});

describe("discordIpcPipePath", () => {
	test("Windows uses the Discord named pipe", () => {
		expect(discordIpcPipePath(0, "win32")).toBe("\\\\.\\pipe\\discord-ipc-0");
	});
});
