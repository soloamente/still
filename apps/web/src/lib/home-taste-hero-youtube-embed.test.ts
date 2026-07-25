import { describe, expect, test } from "bun:test";

import {
	isYouTubeEmbedPlaybackBlocked,
	parseTasteHeroYouTubeEmbed,
} from "./home-taste-hero-youtube-embed";

describe("parseTasteHeroYouTubeEmbed", () => {
	test("reads video id and origin from taste-hero embed URL", () => {
		const parsed = parseTasteHeroYouTubeEmbed(
			"https://www.youtube.com/embed/abc123XYZ01?autoplay=1&origin=https%3A%2F%2Fsense.example",
		);
		expect(parsed).toEqual({
			videoId: "abc123XYZ01",
			origin: "https://sense.example",
		});
	});

	test("returns null for Vimeo", () => {
		expect(
			parseTasteHeroYouTubeEmbed("https://player.vimeo.com/video/999"),
		).toBeNull();
	});
});

describe("isYouTubeEmbedPlaybackBlocked", () => {
	test("treats age / embed restriction codes as blocked", () => {
		expect(isYouTubeEmbedPlaybackBlocked(101)).toBe(true);
		expect(isYouTubeEmbedPlaybackBlocked(150)).toBe(true);
	});

	test("ignores unknown codes", () => {
		expect(isYouTubeEmbedPlaybackBlocked(0)).toBe(false);
	});
});
