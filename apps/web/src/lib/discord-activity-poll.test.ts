import { describe, expect, test } from "bun:test";

import { discordActivityTransitionKey } from "./discord-activity-poll";

describe("discordActivityTransitionKey", () => {
	test("changes when track identity changes", () => {
		const a = discordActivityTransitionKey({
			kind: "listening",
			label: "Listening to Song A",
			headline: "Song A",
			detail: "Artist",
			imageUrl: "https://example.com/a.jpg",
			source: "Apple Music",
		});
		const b = discordActivityTransitionKey({
			kind: "listening",
			label: "Listening to Song B",
			headline: "Song B",
			detail: "Artist",
			imageUrl: "https://example.com/b.jpg",
			source: "Apple Music",
		});

		expect(a).not.toBe(b);
	});

	test("stays stable for the same track metadata", () => {
		const activity = {
			kind: "listening" as const,
			label: "Listening to Song A",
			headline: "Song A",
			detail: "Artist",
			imageUrl: "https://example.com/a.jpg",
			source: "Apple Music",
			accentColor: "#ff0000",
		};

		expect(discordActivityTransitionKey(activity)).toBe(
			discordActivityTransitionKey({ ...activity, accentColor: "#00ff00" }),
		);
	});
});
