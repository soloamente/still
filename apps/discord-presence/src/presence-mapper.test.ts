import { describe, expect, test } from "bun:test";

import { toLanyardPresence } from "./presence-mapper";

const EMPTY_SUCCESS = {
	discord_status: "offline",
	activities: [],
	listening_to_spotify: false,
	spotify: null,
};

describe("toLanyardPresence", () => {
	test("maps Spotify type 2 to listening_to_spotify and CDN album art", () => {
		const result = toLanyardPresence({
			status: "online",
			activities: [
				{
					type: 2,
					name: "Spotify",
					details: "Bohemian Rhapsody",
					state: "Queen",
					assets: {
						large_image: "spotify:ab67616d0000b273e8b066f70c206551210d902b",
						large_text: "A Night at the Opera",
					},
					timestamps: { start: 1_700_000_000_000, end: 1_700_000_354_000 },
				},
			],
		});

		expect(result.listening_to_spotify).toBe(true);
		expect(result.discord_status).toBe("online");
		expect(result.spotify).toEqual({
			song: "Bohemian Rhapsody",
			artist: "Queen",
			album: "A Night at the Opera",
			album_art_url:
				"https://i.scdn.co/image/ab67616d0000b273e8b066f70c206551210d902b",
			timestamps: { start: 1_700_000_000_000, end: 1_700_000_354_000 },
		});
		expect(result.activities).toEqual([
			{
				type: 2,
				name: "Spotify",
				details: "Bohemian Rhapsody",
				state: "Queen",
				assets: {
					large_image: "spotify:ab67616d0000b273e8b066f70c206551210d902b",
					large_text: "A Night at the Opera",
				},
				timestamps: { start: 1_700_000_000_000, end: 1_700_000_354_000 },
			},
		]);
	});

	test("unwraps mp:external album art into an https URL", () => {
		const result = toLanyardPresence({
			status: "online",
			activities: [
				{
					type: 2,
					name: "Spotify",
					details: "Motion Picture Soundtrack",
					state: "Radiohead",
					assets: {
						large_image:
							"mp:external/abc123hash/https/i.scdn.co/image/ab12cd34",
						large_text: "Kid A",
					},
				},
			],
		});

		expect(result.listening_to_spotify).toBe(true);
		expect(result.spotify?.album_art_url).toBe(
			"https://i.scdn.co/image/ab12cd34",
		);
		expect(result.spotify?.song).toBe("Motion Picture Soundtrack");
		expect(result.spotify?.artist).toBe("Radiohead");
		expect(result.spotify?.album).toBe("Kid A");
		expect(result.activities).toHaveLength(1);
		expect(result.activities?.[0]?.assets?.large_image).toBe(
			"mp:external/abc123hash/https/i.scdn.co/image/ab12cd34",
		);
	});

	test("leaves already-https album art URLs as-is", () => {
		const result = toLanyardPresence({
			status: "dnd",
			activities: [
				{
					type: 2,
					name: "Spotify",
					details: "Holocene",
					state: "Bon Iver",
					assets: {
						large_image: "https://i.scdn.co/image/already-https",
						large_text: "Bon Iver",
					},
				},
			],
		});

		expect(result.spotify?.album_art_url).toBe(
			"https://i.scdn.co/image/already-https",
		);
	});

	test("copies playing type 0 activities without Spotify convenience fields", () => {
		const playing = {
			type: 0,
			name: "Hades II",
			details: "Erebus",
			state: "Underworld",
			timestamps: { start: 1_700_000_000_000, end: null },
		};

		const result = toLanyardPresence({
			status: "online",
			activities: [playing],
		});

		expect(result.listening_to_spotify).toBe(false);
		expect(result.spotify).toBeNull();
		expect(result.discord_status).toBe("online");
		expect(result.activities).toEqual([playing]);
	});

	test("copies streaming type 1 and watching type 3 activities through", () => {
		const streaming = {
			type: 1,
			name: "Twitch",
			details: "Speedrun",
			state: "Any%",
		};
		const watching = {
			type: 3,
			name: "Netflix",
			details: "Severance",
			state: "S2 E1",
		};

		const result = toLanyardPresence({
			status: "idle",
			activities: [streaming, watching],
		});

		expect(result.listening_to_spotify).toBe(false);
		expect(result.spotify).toBeNull();
		expect(result.discord_status).toBe("idle");
		expect(result.activities).toEqual([streaming, watching]);
	});

	test("does not treat non-Spotify listening (type 2) as Spotify convenience", () => {
		const appleMusic = {
			type: 2,
			name: "Apple Music",
			details: "New Gold",
			state: "Gorillaz",
		};

		const result = toLanyardPresence({
			status: "online",
			activities: [appleMusic],
		});

		expect(result.listening_to_spotify).toBe(false);
		expect(result.spotify).toBeNull();
		expect(result.activities).toEqual([appleMusic]);
	});

	test("empty activities yield no Spotify and an empty activities list", () => {
		const result = toLanyardPresence({
			status: "online",
			activities: [],
		});

		expect(result).toEqual({
			discord_status: "online",
			activities: [],
			listening_to_spotify: false,
			spotify: null,
		});
	});

	test("missing activities yield no Spotify and an empty activities list", () => {
		const result = toLanyardPresence({
			status: "online",
		});

		expect(result).toEqual({
			discord_status: "online",
			activities: [],
			listening_to_spotify: false,
			spotify: null,
		});
	});

	test("offline status yields the empty success shape", () => {
		const result = toLanyardPresence({
			status: "offline",
			activities: [
				{
					type: 0,
					name: "Hades II",
				},
			],
		});

		expect(result).toEqual(EMPTY_SUCCESS);
	});

	test("null snapshot yields the empty success shape", () => {
		expect(toLanyardPresence(null)).toEqual(EMPTY_SUCCESS);
	});

	test("undefined snapshot yields the empty success shape", () => {
		expect(toLanyardPresence(undefined)).toEqual(EMPTY_SUCCESS);
	});
});
