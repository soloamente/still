import { describe, expect, test } from "bun:test";

import { movieLooksTheatricalOnly } from "./movie-theatrical-only";

describe("movieLooksTheatricalOnly", () => {
	const now = new Date("2026-07-21T12:00:00.000Z");

	test("theatrical in the past without digital → true", () => {
		expect(
			movieLooksTheatricalOnly(
				{
					results: [
						{
							iso_3166_1: "US",
							release_dates: [
								{ type: 3, release_date: "2026-07-10T00:00:00.000Z" },
							],
						},
					],
				},
				now,
			),
		).toBe(true);
	});

	test("theatrical plus past digital → false", () => {
		expect(
			movieLooksTheatricalOnly(
				{
					results: [
						{
							iso_3166_1: "US",
							release_dates: [
								{ type: 3, release_date: "2026-06-01T00:00:00.000Z" },
								{ type: 4, release_date: "2026-07-01T00:00:00.000Z" },
							],
						},
					],
				},
				now,
			),
		).toBe(false);
	});

	test("theatrical with future digital only → true", () => {
		expect(
			movieLooksTheatricalOnly(
				{
					results: [
						{
							iso_3166_1: "US",
							release_dates: [
								{ type: 3, release_date: "2026-07-01T00:00:00.000Z" },
								{ type: 4, release_date: "2026-12-01T00:00:00.000Z" },
							],
						},
					],
				},
				now,
			),
		).toBe(true);
	});

	test("no theatrical → false", () => {
		expect(
			movieLooksTheatricalOnly(
				{
					results: [
						{
							iso_3166_1: "US",
							release_dates: [
								{ type: 4, release_date: "2026-07-01T00:00:00.000Z" },
							],
						},
					],
				},
				now,
			),
		).toBe(false);
	});
});
