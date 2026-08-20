import { describe, expect, test } from "bun:test";

import { discordActivitySelfScreenReaderLabel } from "./discord-activity-self-copy";

describe("discordActivitySelfScreenReaderLabel", () => {
	test("listening includes song and artist", () => {
		expect(
			discordActivitySelfScreenReaderLabel({
				kind: "listening",
				label: "Listening to Let Go",
				detail: "Ariana Grande",
			}),
		).toBe("You are listening to Let Go by Ariana Grande");
	});

	test("playing uses second person", () => {
		expect(
			discordActivitySelfScreenReaderLabel({
				kind: "playing",
				label: "Playing Hades II",
				detail: "In the underworld",
			}),
		).toBe("You are playing Hades II: In the underworld");
	});

	test("streaming uses second person", () => {
		expect(
			discordActivitySelfScreenReaderLabel({
				kind: "streaming",
				label: "Streaming Sense launch",
			}),
		).toBe("You are streaming Sense launch");
	});

	test("watching uses second person", () => {
		expect(
			discordActivitySelfScreenReaderLabel({
				kind: "watching",
				label: "Watching Frieren",
				detail: "Episode 12",
			}),
		).toBe("You are watching Frieren: Episode 12");
	});
});
