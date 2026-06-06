import { describe, expect, test } from "bun:test";

import { resolveLobbyBodyGateMode } from "@/lib/home-lobby-body-gate-mode";

describe("resolveLobbyBodyGateMode", () => {
	test("settled when client and server agree on community", () => {
		expect(
			resolveLobbyBodyGateMode({
				activeBrowse: "community",
				clientUrlBrowse: "community",
				serverBrowse: "community",
			}),
		).toBe("settled");
	});

	test("community-pending during optimistic tap to community", () => {
		expect(
			resolveLobbyBodyGateMode({
				activeBrowse: "community",
				clientUrlBrowse: "movies",
				serverBrowse: "movies",
			}),
		).toBe("community-pending");
	});

	test("tmdb-pending during optimistic tap away from community", () => {
		expect(
			resolveLobbyBodyGateMode({
				activeBrowse: "movies",
				clientUrlBrowse: "community",
				serverBrowse: "community",
			}),
		).toBe("tmdb-pending");
	});

	test("community-pending when client URL is community but RSC rendered movies", () => {
		expect(
			resolveLobbyBodyGateMode({
				activeBrowse: "community",
				clientUrlBrowse: "community",
				serverBrowse: "movies",
			}),
		).toBe("community-pending");
	});

	test("tmdb-pending when client URL is movies but RSC rendered community", () => {
		expect(
			resolveLobbyBodyGateMode({
				activeBrowse: "movies",
				clientUrlBrowse: "movies",
				serverBrowse: "community",
			}),
		).toBe("tmdb-pending");
	});

	test("settled during sort or venue change on the same browse branch", () => {
		expect(
			resolveLobbyBodyGateMode({
				activeBrowse: "movies",
				clientUrlBrowse: "movies",
				serverBrowse: "movies",
			}),
		).toBe("settled");
		expect(
			resolveLobbyBodyGateMode({
				activeBrowse: "tv",
				clientUrlBrowse: "tv",
				serverBrowse: "tv",
			}),
		).toBe("settled");
	});
});
