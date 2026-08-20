import { describe, expect, it } from "bun:test";

import {
	formatDiscordActivity,
	type LanyardPresencePayload,
} from "./discord-activity";

describe("formatDiscordActivity", () => {
	it("formats Spotify listening with album art", () => {
		const result = formatDiscordActivity({
			listening_to_spotify: true,
			spotify: {
				song: "Let Go",
				artist: "Ark Patrol; Veronika Redd",
				album: "Let Go",
				album_art_url:
					"https://i.scdn.co/image/ab67616d0000b27364840995fe43bb2ec73a241d",
			},
			activities: [],
			discord_status: "online",
		});

		expect(result).toEqual({
			kind: "listening",
			label: "Listening to Let Go",
			headline: "Let Go",
			source: "Spotify",
			detail: "Ark Patrol; Veronika Redd",
			albumName: "Let Go",
			imageUrl:
				"https://i.scdn.co/image/ab67616d0000b27364840995fe43bb2ec73a241d",
		});
	});

	it("formats listening activity (type 2) such as Apple Music RPC", () => {
		const result = formatDiscordActivity({
			listening_to_spotify: false,
			spotify: null,
			activities: [
				{
					type: 4,
					state: "To your eternity",
				},
				{
					type: 2,
					name: "Apple Music",
					details: "In Your Eyes / ひとみ",
					state: "Suzu Toyama",
					timestamps: {
						start: 1_785_414_852_868,
						end: 1_785_415_047_348,
					},
					assets: {
						large_image:
							"mp:external/kJDMA_q5TtsAa38WKj10SXxcGGUWutukdW08KX0ZxKw/https/is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/05/32/690532bb-8cc0-c567-a2a5-5a8dc46d5948/4500000079854.jpg/128x128sr.jpg",
						large_text: "In Your Eyes",
						small_image:
							"mp:external/artist/https/is1-ssl.mzstatic.com/image/thumb/AMCArtistImages/artist.jpg",
						small_text: "Suzu Toyama",
					},
				},
			],
			discord_status: "online",
		});

		expect(result).toEqual({
			kind: "listening",
			label: "Listening to In Your Eyes / ひとみ",
			headline: "In Your Eyes / ひとみ",
			source: "Apple Music",
			detail: "Suzu Toyama",
			imageUrl:
				"https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/05/32/690532bb-8cc0-c567-a2a5-5a8dc46d5948/4500000079854.jpg/128x128sr.jpg",
			albumName: "In Your Eyes",
			creatorName: "Suzu Toyama",
			creatorImageUrl:
				"https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages/artist.jpg",
			progress: {
				startedAtMs: 1_785_414_852_868,
				endsAtMs: 1_785_415_047_348,
			},
		});
	});

	it("formats playing activity (type 0)", () => {
		const result = formatDiscordActivity({
			listening_to_spotify: false,
			spotify: null,
			activities: [
				{
					type: 0,
					name: "Hades II",
					details: "Temple of Styx",
				},
			],
			discord_status: "online",
		});

		expect(result).toEqual({
			kind: "playing",
			label: "Playing Hades II",
			headline: "Hades II",
			source: "Hades II",
			detail: "Temple of Styx",
		});
	});

	it("formats streaming activity (type 1)", () => {
		const result = formatDiscordActivity({
			listening_to_spotify: false,
			spotify: null,
			activities: [
				{
					type: 1,
					name: "YouTube",
					details: "Interstellar — docking scene",
				},
			],
			discord_status: "online",
		});

		expect(result).toEqual({
			kind: "streaming",
			label: "Streaming Interstellar — docking scene",
			headline: "Interstellar — docking scene",
			source: "YouTube",
		});
	});

	it("ignores custom status (type 4) when no richer activity", () => {
		const result = formatDiscordActivity({
			listening_to_spotify: false,
			spotify: null,
			activities: [
				{
					type: 4,
					state: "movie night",
					emoji: { name: "🎬" },
				},
			],
			discord_status: "dnd",
		});

		expect(result).toBeNull();
	});

	it("formats watching activity (type 3)", () => {
		const result = formatDiscordActivity({
			listening_to_spotify: false,
			spotify: null,
			activities: [
				{
					type: 3,
					name: "Crunchyroll",
					details: "Frieren: Beyond Journey's End",
					state: "Episode 12",
				},
			],
			discord_status: "online",
		});

		expect(result).toEqual({
			kind: "watching",
			label: "Watching Frieren: Beyond Journey's End",
			headline: "Frieren: Beyond Journey's End",
			source: "Crunchyroll",
			detail: "Episode 12",
			imageUrl: null,
		});
	});

	it("prefers Spotify over other activities", () => {
		const result = formatDiscordActivity({
			listening_to_spotify: true,
			spotify: {
				song: "Let Go",
				artist: "Ark Patrol",
				album_art_url: null,
			},
			activities: [
				{
					type: 0,
					name: "Hades II",
				},
			],
			discord_status: "online",
		});

		expect(result?.kind).toBe("listening");
	});

	it("returns null when there is no displayable activity", () => {
		expect(formatDiscordActivity(null)).toBeNull();
		expect(
			formatDiscordActivity({
				listening_to_spotify: false,
				spotify: null,
				activities: [],
				discord_status: "offline",
			}),
		).toBeNull();
		expect(
			formatDiscordActivity({
				listening_to_spotify: false,
				spotify: null,
				activities: [{ type: 5, name: "Competing in Apex" }],
				discord_status: "idle",
			} satisfies LanyardPresencePayload),
		).toBeNull();
	});
});
