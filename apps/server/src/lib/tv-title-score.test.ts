import { describe, expect, test } from "bun:test";
import {
	ledgerDisplayRatingForTvLog,
	resolveTvSeasonScore,
	resolveTvTitleScore,
} from "./tv-title-score";

describe("resolveTvTitleScore", () => {
	test("returns null when no rated logs", () => {
		expect(resolveTvTitleScore([])).toBeNull();
		expect(
			resolveTvTitleScore([
				{ logScope: "season", seasonNumber: 1, rating: null },
			]),
		).toBeNull();
	});

	test("show-scoped ratings win over seasons", () => {
		expect(
			resolveTvTitleScore([
				{ logScope: "show", rating: 90 },
				{ logScope: "season", seasonNumber: 1, rating: 50 },
			]),
		).toBe(90);
	});

	test("averages multiple show-scoped rewatches", () => {
		expect(
			resolveTvTitleScore([
				{ logScope: "show", rating: 80 },
				{ logScope: "show", rating: 100 },
			]),
		).toBe(90);
	});

	test("null logScope counts as show", () => {
		expect(resolveTvTitleScore([{ logScope: null, rating: 70 }])).toBe(70);
	});

	test("averages season scores when no show rating", () => {
		// S1 mean 80, S2 mean 100 → title 90
		expect(
			resolveTvTitleScore([
				{ logScope: "season", seasonNumber: 1, rating: 80 },
				{ logScope: "season", seasonNumber: 2, rating: 100 },
			]),
		).toBe(90);
	});

	test("episode ratings fill a season only when no season log", () => {
		expect(
			resolveTvTitleScore([
				{ logScope: "episode", seasonNumber: 1, rating: 60 },
				{ logScope: "episode", seasonNumber: 1, rating: 80 },
			]),
		).toBe(70);
		// Season log preferred over episodes in same season
		expect(
			resolveTvTitleScore([
				{ logScope: "season", seasonNumber: 1, rating: 90 },
				{ logScope: "episode", seasonNumber: 1, rating: 40 },
			]),
		).toBe(90);
	});

	test("ignores season/episode rows without seasonNumber", () => {
		expect(
			resolveTvTitleScore([
				{ logScope: "season", seasonNumber: null, rating: 99 },
			]),
		).toBeNull();
	});
});

describe("resolveTvSeasonScore", () => {
	test("means season-scoped ratings for one season", () => {
		expect(
			resolveTvSeasonScore(
				[
					{ logScope: "season", seasonNumber: 2, rating: 70 },
					{ logScope: "season", seasonNumber: 2, rating: 90 },
					{ logScope: "season", seasonNumber: 1, rating: 10 },
				],
				2,
			),
		).toBe(80);
	});
});

describe("ledgerDisplayRatingForTvLog", () => {
	test("maps show/season/episode tiles to the right derived rating", () => {
		const set = [
			{
				tvId: 1,
				logScope: "season" as const,
				seasonNumber: 1,
				rating: 80,
			},
			{
				tvId: 1,
				logScope: "season" as const,
				seasonNumber: 2,
				rating: 100,
			},
			{
				tvId: 1,
				logScope: "show" as const,
				seasonNumber: null,
				rating: 60,
			},
			{
				tvId: 1,
				logScope: "episode" as const,
				seasonNumber: 1,
				rating: 45,
			},
		];

		expect(
			ledgerDisplayRatingForTvLog(
				{ tvId: 1, logScope: "show", seasonNumber: null, rating: 60 },
				set,
			),
		).toBe(60);
		expect(
			ledgerDisplayRatingForTvLog(
				{ tvId: 1, logScope: "season", seasonNumber: 2, rating: 100 },
				set,
			),
		).toBe(100);
		expect(
			ledgerDisplayRatingForTvLog(
				{ tvId: 1, logScope: "episode", seasonNumber: 1, rating: 45 },
				set,
			),
		).toBe(45);
	});
});
