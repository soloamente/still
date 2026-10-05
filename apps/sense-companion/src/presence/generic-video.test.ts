import { describe, expect, test } from "bun:test";

import {
	cleanWatchTitle,
	isDedicatedCompanionHost,
	isWatchableVideo,
	pickWatchableVideo,
	seasonEpisodeFromTitle,
	serviceLabelFromHostname,
} from "./generic-video";

describe("generic video pages", () => {
	test("dedicated players stay on their own scripts", () => {
		expect(isDedicatedCompanionHost("www.netflix.com")).toBe(true);
		expect(isDedicatedCompanionHost("play.max.com")).toBe(true);
		expect(isDedicatedCompanionHost("movy.sx")).toBe(false);
	});

	test("the site name comes from the hostname", () => {
		expect(serviceLabelFromHostname("www.movy.sx")).toBe("Movy");
		expect(serviceLabelFromHostname("play.cineby.app")).toBe("Cineby");
	});

	test("the page title drops the site suffix", () => {
		expect(cleanWatchTitle("Dune: Part Two - Movy", "Movy")).toBe(
			"Dune: Part Two",
		);
		expect(cleanWatchTitle("Watch Dune: Part Two online free", "Movy")).toBe(
			"Dune: Part Two",
		);
	});

	test("season and episode marks become an episode watch", () => {
		expect(seasonEpisodeFromTitle("The Boys S02E03")).toEqual({
			kind: "episode",
			season: 2,
			episode: 3,
		});
	});

	test("short and tiny videos are ignored", () => {
		expect(
			isWatchableVideo({
				paused: false,
				ended: false,
				currentTime: 10,
				duration: 30,
				videoWidth: 1280,
				videoHeight: 720,
			}),
		).toBe(false);
		const film = {
			paused: false,
			ended: false,
			currentTime: 120,
			duration: 7200,
			videoWidth: 1280,
			videoHeight: 720,
		};
		const ad = {
			...film,
			duration: 15,
			videoWidth: 300,
			videoHeight: 200,
		};
		expect(pickWatchableVideo([ad, film])).toBe(film);
	});
});
