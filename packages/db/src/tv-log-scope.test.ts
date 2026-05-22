import { describe, expect, it } from "bun:test";

import { validateTvLogScope } from "./tv-log-scope";

describe("validateTvLogScope", () => {
	it("requires season and episode for episode scope", () => {
		expect(
			validateTvLogScope({ logScope: "episode", seasonNumber: 1 }),
		).toEqual({ ok: false, message: "Episode logs require episodeNumber" });
	});

	it("allows show scope without numbers", () => {
		expect(validateTvLogScope({ logScope: "show" })).toEqual({ ok: true });
	});

	it("requires seasonNumber for season scope", () => {
		expect(validateTvLogScope({ logScope: "season" })).toEqual({
			ok: false,
			message: "Season logs require seasonNumber",
		});
	});

	it("accepts valid episode scope", () => {
		expect(
			validateTvLogScope({
				logScope: "episode",
				seasonNumber: 2,
				episodeNumber: 4,
			}),
		).toEqual({ ok: true });
	});
});
