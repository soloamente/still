import { describe, expect, test } from "bun:test";

import {
	DEFAULT_DISCORD_ACTIVITY_LAYOUT,
	finalizeDiscordActivityFields,
	readDiscordActivityLayout,
	resolveDiscordActivityFields,
	resolveDiscordActivityFromMessage,
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

	test("a film with no extra meta names the platform", () => {
		expect(
			resolveDiscordActivityFromMessage(
				{
					service: "Movy",
					presenceMode: "playing",
					senseMedia: {
						kind: "movie",
						title: "Runner",
						season: null,
						episode: null,
					},
					activity: {
						name: "Runner",
						details: "Movy",
						state: null,
						smallImageText: "Playing",
						startTimestamp: 1,
						endTimestamp: 2,
					},
				},
				DEFAULT_DISCORD_ACTIVITY_LAYOUT,
			),
		).toEqual({
			name: "with Sense",
			details: "Runner",
			state: "On Movy",
			largeText: "Runner",
		});
	});

	test("an episode fills the title, the episode, and Sense", () => {
		expect(
			resolveDiscordActivityFromMessage(
				{
					service: "Netflix",
					presenceMode: "playing",
					senseMedia: {
						kind: "episode",
						title: "Stranger Things",
						season: 4,
						episode: 1,
					},
					activity: {
						name: "Stranger Things",
						details: "Chapter One",
						state: null,
						smallImageText: "Playing",
						startTimestamp: 1,
						endTimestamp: 2,
					},
				},
				DEFAULT_DISCORD_ACTIVITY_LAYOUT,
			),
		).toEqual({
			name: "with Sense",
			details: "Stranger Things",
			state: "S4 E1 - Chapter One",
			largeText: "Stranger Things",
		});
	});

	test("films put the title on the Watching line and the year under it", () => {
		expect(
			resolveDiscordActivityFromMessage(
				{
					service: "Netflix",
					presenceMode: "playing",
					senseMedia: {
						provider: "netflix",
						kind: "movie",
						title: "Dune",
						season: null,
						episode: null,
						positionSec: 100,
						durationSec: 9000,
					},
					activity: {
						name: null,
						details: "Dune",
						state: "2021 · 155m",
						smallImageText: "Playing",
						startTimestamp: 1,
						endTimestamp: 2,
					},
				},
				DEFAULT_DISCORD_ACTIVITY_LAYOUT,
			),
		).toEqual({
			name: "with Sense",
			details: "Dune",
			state: "On Netflix",
			largeText: "Dune",
		});
	});

	test("exploring uses Watching with Sense and On the platform", () => {
		expect(
			resolveDiscordActivityFromMessage(
				{
					service: "Max",
					pagePath: "/browse",
					senseMedia: null,
					activity: {
						name: null,
						details: "Browsing Max...",
						state: null,
						smallImageText: "Browsing",
						startTimestamp: 1,
						endTimestamp: null,
					},
				},
				DEFAULT_DISCORD_ACTIVITY_LAYOUT,
			),
		).toEqual({
			name: "with Sense",
			details: "Browsing the home page",
			state: "On HBO Max",
			largeText: "Browsing the home page",
		});
	});

	test("a movie page names the title under Watching with Sense", () => {
		expect(
			resolveDiscordActivityFromMessage(
				{
					service: "HBO Max",
					pagePath: "/movie/dune",
					senseMedia: null,
					activity: {
						name: null,
						details: "Dune",
						state: "Epic sci-fi",
						smallImageText: "Browsing",
						startTimestamp: 1,
						endTimestamp: null,
					},
				},
				DEFAULT_DISCORD_ACTIVITY_LAYOUT,
			),
		).toEqual({
			name: "with Sense",
			details: "Browsing Dune page",
			state: "On HBO Max",
			largeText: "Dune",
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
