import { describe, expect, test } from "bun:test";

import {
	buildTodayCirclePayload,
	reviewExcerptPlainText,
	type TodayCircleRow,
} from "./today-circle-activity";

function row(overrides: Partial<TodayCircleRow>): TodayCircleRow {
	return {
		logId: "log_1",
		actorUserId: "user_a",
		handle: "anselmo",
		displayName: "Anselmo",
		actorImage: null,
		rating: 85,
		movieId: 438631,
		tvId: null,
		movieTitle: "Dune",
		moviePosterPath: "/dune.jpg",
		tvTitle: null,
		tvPosterPath: null,
		reviewBody: null,
		reviewContainsSpoilers: null,
		...overrides,
	};
}

const badge = { planTier: "still" as const, staffRole: null };

describe("buildTodayCirclePayload", () => {
	test("no visible row → invite (never invent activity)", () => {
		expect(buildTodayCirclePayload(null, null)).toEqual({ kind: "invite" });
	});

	test("movie log maps to activity with display rating", () => {
		expect(buildTodayCirclePayload(row({}), badge)).toEqual({
			kind: "activity",
			actor: {
				userId: "user_a",
				handle: "anselmo",
				displayName: "Anselmo",
				image: null,
				planTier: "still",
				staffRole: null,
			},
			title: {
				mediaKind: "movie",
				tmdbId: 438631,
				name: "Dune",
				posterPath: "/dune.jpg",
			},
			ratingDisplay: 8.5,
			excerpt: null,
			logId: "log_1",
		});
	});

	test("unrated log keeps ratingDisplay null", () => {
		const payload = buildTodayCirclePayload(row({ rating: null }), badge);
		expect(payload.kind === "activity" && payload.ratingDisplay).toBeNull();
	});

	test("tv log maps to tv title", () => {
		const payload = buildTodayCirclePayload(
			row({
				movieId: null,
				movieTitle: null,
				moviePosterPath: null,
				tvId: 1399,
				tvTitle: "Severance",
				tvPosterPath: "/sev.jpg",
			}),
			badge,
		);
		expect(payload.kind === "activity" && payload.title).toEqual({
			mediaKind: "tv",
			tmdbId: 1399,
			name: "Severance",
			posterPath: "/sev.jpg",
		});
	});

	test("linked review adds an excerpt", () => {
		const payload = buildTodayCirclePayload(
			row({
				reviewBody: "A **towering** epic.",
				reviewContainsSpoilers: false,
			}),
			badge,
		);
		expect(payload.kind === "activity" && payload.excerpt).toBe(
			"A towering epic.",
		);
	});

	test("spoiler review never leaks an excerpt", () => {
		const payload = buildTodayCirclePayload(
			row({ reviewBody: "Paul dies at the end", reviewContainsSpoilers: true }),
			badge,
		);
		expect(payload.kind === "activity" && payload.excerpt).toBeNull();
	});

	test("missing cached title falls back to invite", () => {
		expect(buildTodayCirclePayload(row({ movieTitle: null }), badge)).toEqual({
			kind: "invite",
		});
	});
});

describe("reviewExcerptPlainText", () => {
	test("mention tokens render as their labels", () => {
		expect(
			reviewExcerptPlainText(
				"Better than #[Arrival](/movies/329865), says @[Denis](/people/1032).",
			),
		).toBe("Better than Arrival, says Denis.");
	});

	test("strips markdown markers and collapses whitespace", () => {
		expect(reviewExcerptPlainText("> _Quiet_\n\n`slow`   # burn")).toBe(
			"Quiet slow burn",
		);
	});

	test("truncates on a word boundary with an ellipsis", () => {
		const excerpt = reviewExcerptPlainText(
			"one two three four five six seven",
			14,
		);
		expect(excerpt).toBe("one two three…");
	});

	test("empty after stripping → null", () => {
		expect(reviewExcerptPlainText("  **  ")).toBeNull();
	});
});
