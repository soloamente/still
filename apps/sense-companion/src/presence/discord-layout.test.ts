import { describe, expect, test } from "bun:test";

import {
	DEFAULT_DISCORD_ACTIVITY_LAYOUT,
	readDiscordActivityLayout,
	resolveDiscordActivityFields,
} from "./discord-layout";

const PARTS = {
	title: "Stranger Things",
	episodeTitle: "Chapter One",
	seasonEpisode: "S4 E1",
	service: "Netflix",
};

describe("discord activity layout", () => {
	test("the default card is the title, the episode, and Sense", () => {
		expect(
			resolveDiscordActivityFields(DEFAULT_DISCORD_ACTIVITY_LAYOUT, PARTS),
		).toEqual({
			name: "Stranger Things",
			details: "S4 E1",
			state: "Sense",
			largeText: "Stranger Things",
		});
	});

	test("each line can move, and an empty title line falls back to the show", () => {
		expect(
			resolveDiscordActivityFields(
				{
					name: "service",
					details: "episodeTitle",
					state: "empty",
					largeText: "seasonEpisode",
					cover: "artwork",
				},
				PARTS,
			),
		).toEqual({
			name: "Netflix",
			details: "Chapter One",
			state: null,
			largeText: "S4 E1",
		});
		expect(
			resolveDiscordActivityFields(
				{
					...DEFAULT_DISCORD_ACTIVITY_LAYOUT,
					name: "empty",
				},
				PARTS,
			).name,
		).toBe("Stranger Things");
	});

	test("a broken saved layout falls back field by field", () => {
		expect(
			readDiscordActivityLayout({
				name: "service",
				details: "nope",
				cover: "none",
			}),
		).toEqual({
			...DEFAULT_DISCORD_ACTIVITY_LAYOUT,
			name: "service",
			cover: "none",
		});
	});

	test("the profile button is on unless the saved layout hides it", () => {
		expect(DEFAULT_DISCORD_ACTIVITY_LAYOUT.profileButton).toBe("show");
		expect(readDiscordActivityLayout({ name: "service" }).profileButton).toBe(
			"show",
		);
		expect(
			readDiscordActivityLayout({ profileButton: "hide" }).profileButton,
		).toBe("hide");
		expect(
			readDiscordActivityLayout({ profileButton: "nope" }).profileButton,
		).toBe("show");
	});
});
