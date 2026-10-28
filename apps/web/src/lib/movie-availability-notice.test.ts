import { describe, expect, test } from "bun:test";

import { movieNotYetAvailableCopy } from "./movie-availability-notice";

const now = new Date("2026-10-28T12:00:00.000Z");

describe("movieNotYetAvailableCopy", () => {
	test("region with only a future theatrical date names that day", () => {
		expect(
			movieNotYetAvailableCopy({
				region: "IT",
				primaryReleaseDate: "2026-09-25",
				status: "Released",
				now,
				releaseDates: {
					results: [
						{
							iso_3166_1: "IT",
							release_dates: [
								{ type: 1, release_date: "2026-10-23T00:00:00.000Z" },
								{ type: 3, release_date: "2027-01-14T00:00:00.000Z" },
							],
						},
					],
				},
			}),
		).toEqual({
			lead: "Not available yet.",
			when: "In theaters Jan 14, 2027.",
		});
	});

	test("a past theatrical date in the region hides the line", () => {
		expect(
			movieNotYetAvailableCopy({
				region: "US",
				primaryReleaseDate: "2026-09-25",
				status: "Released",
				now,
				releaseDates: {
					results: [
						{
							iso_3166_1: "US",
							release_dates: [
								{ type: 2, release_date: "2026-10-16" },
								{ type: 4, release_date: "2026-12-02" },
							],
						},
					],
				},
			}),
		).toBeNull();
	});

	test("future theatrical and digital both get a sentence", () => {
		expect(
			movieNotYetAvailableCopy({
				region: "US",
				primaryReleaseDate: "2026-11-06",
				status: "Released",
				now,
				releaseDates: {
					results: [
						{
							iso_3166_1: "US",
							release_dates: [
								{ type: 3, release_date: "2026-11-06" },
								{ type: 4, release_date: "2026-12-02" },
							],
						},
					],
				},
			}),
		).toEqual({
			lead: "Not available yet.",
			when: "In theaters Nov 6. At home Dec 2.",
		});
	});

	test("digital-only future date says at home", () => {
		expect(
			movieNotYetAvailableCopy({
				region: "CA",
				primaryReleaseDate: null,
				status: "Released",
				now,
				releaseDates: {
					results: [
						{
							iso_3166_1: "CA",
							release_dates: [{ type: 4, release_date: "2026-12-02" }],
						},
					],
				},
			}),
		).toEqual({
			lead: "Not available yet.",
			when: "At home Dec 2.",
		});
	});

	test("same day in theaters and at home stays one clause", () => {
		expect(
			movieNotYetAvailableCopy({
				region: "FR",
				primaryReleaseDate: "2026-12-02",
				status: "Post Production",
				now,
				releaseDates: {
					results: [
						{
							iso_3166_1: "FR",
							release_dates: [
								{ type: 3, release_date: "2026-12-02" },
								{ type: 4, release_date: "2026-12-02" },
							],
						},
					],
				},
			}),
		).toEqual({
			lead: "Not available yet.",
			when: "In theaters and at home Dec 2.",
		});
	});

	test("no region uses a future primary date and skips other countries", () => {
		expect(
			movieNotYetAvailableCopy({
				region: null,
				primaryReleaseDate: "2027-01-14T00:00:00.000Z",
				status: "Post Production",
				now,
				releaseDates: {
					results: [
						{
							iso_3166_1: "US",
							release_dates: [{ type: 3, release_date: "2026-11-06" }],
						},
					],
				},
			}),
		).toEqual({
			lead: "Not available yet.",
			when: "Jan 14, 2027.",
		});
	});

	test("released film with a past primary date and no region stays quiet", () => {
		expect(
			movieNotYetAvailableCopy({
				region: null,
				primaryReleaseDate: "2024-03-01",
				status: "Released",
				now,
				releaseDates: null,
			}),
		).toBeNull();
	});
});
