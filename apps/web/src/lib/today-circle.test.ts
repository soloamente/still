import { describe, expect, test } from "bun:test";

import {
	type TodayCircleActivity,
	todayCircleActionLabel,
	todayCircleTitleHref,
} from "./today-circle";

const activity: TodayCircleActivity = {
	kind: "activity",
	actor: {
		userId: "u1",
		handle: "anselmo",
		displayName: "Anselmo",
		image: null,
		planTier: "still",
		staffRole: null,
	},
	title: { mediaKind: "movie", tmdbId: 438631, name: "Dune", posterPath: null },
	ratingDisplay: 8.5,
	excerpt: null,
	logId: "log_1",
};

describe("todayCircleTitleHref", () => {
	test("movie and tv detail routes", () => {
		expect(todayCircleTitleHref(activity.title)).toBe("/movies/438631");
		expect(
			todayCircleTitleHref({
				...activity.title,
				mediaKind: "tv",
				tmdbId: 1399,
			}),
		).toBe("/tv/1399");
	});
});

describe("todayCircleActionLabel", () => {
	test("rated watch", () => {
		expect(todayCircleActionLabel(activity)).toBe("Rated it 8.5");
	});

	test("max score shows 10 not 10.0", () => {
		expect(todayCircleActionLabel({ ...activity, ratingDisplay: 10 })).toBe(
			"Rated it 10",
		);
	});

	test("unrated watch", () => {
		expect(todayCircleActionLabel({ ...activity, ratingDisplay: null })).toBe(
			"Watched it",
		);
	});
});
