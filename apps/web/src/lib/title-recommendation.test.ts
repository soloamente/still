import { describe, expect, test } from "bun:test";

import {
	parseRecommendationNotificationPayload,
	RECOMMEND_REASON_OPTIONS,
	recommendSendErrorMessage,
	recommendSuggestionMeta,
	sendRecommendationErrorCode,
} from "./title-recommendation";

describe("parseRecommendationNotificationPayload", () => {
	test("reads a film recommendation", () => {
		expect(
			parseRecommendationNotificationPayload({
				recommendationId: "rec_1",
				fromUserId: "u1",
				fromName: "Anselmo",
				fromHandle: "anselmo",
				mediaKind: "movie",
				movieId: 603,
				href: "/movies/603?recommend=rec_1",
			}),
		).toEqual({
			recommendationId: "rec_1",
			fromUserId: "u1",
			fromName: "Anselmo",
			mediaKind: "movie",
			tmdbId: 603,
		});
	});

	test("reads a show and falls back to the handle for the name", () => {
		expect(
			parseRecommendationNotificationPayload({
				recommendationId: "rec_2",
				fromUserId: "u1",
				fromHandle: "anselmo",
				mediaKind: "tv",
				tvId: 1399,
			}),
		).toMatchObject({ fromName: "@anselmo", mediaKind: "tv", tmdbId: 1399 });
	});

	test("rejects payloads missing ids", () => {
		expect(parseRecommendationNotificationPayload({})).toBeNull();
		expect(
			parseRecommendationNotificationPayload({
				recommendationId: "rec_1",
				fromUserId: "u1",
				mediaKind: "movie",
			}),
		).toBeNull();
	});
});

describe("sendRecommendationErrorCode", () => {
	test("extracts the server code from an error body", () => {
		expect(sendRecommendationErrorCode({ code: "confirm_sensitive" })).toBe(
			"confirm_sensitive",
		);
		expect(sendRecommendationErrorCode("Slow down")).toBeNull();
		expect(sendRecommendationErrorCode(null)).toBeNull();
	});
});

describe("recommendSendErrorMessage", () => {
	test("human copy per server code, generic fallback", () => {
		expect(recommendSendErrorMessage("already_recommended", 409, "Mia")).toBe(
			"You’ve already sent this to Mia.",
		);
		expect(recommendSendErrorMessage(null, 429, "Mia")).toBe(
			"You’re sending a lot right now — try again in a bit.",
		);
		expect(recommendSendErrorMessage(null, 500, "Mia")).toBe(
			"Couldn’t send that. Try again.",
		);
		expect(recommendSendErrorMessage("not_connected", 403, "Mia")).toBe(
			"You can only recommend to people you follow or who follow you.",
		);
	});
});

describe("recommendSuggestionMeta", () => {
	test("kind + your score or favorite", () => {
		expect(
			recommendSuggestionMeta({
				mediaKind: "movie",
				ratingTenths: 85,
				liked: false,
			}),
		).toBe("Film · You rated 8.5");
		expect(
			recommendSuggestionMeta({
				mediaKind: "tv",
				ratingTenths: 100,
				liked: true,
			}),
		).toBe("Show · You rated 10");
		expect(
			recommendSuggestionMeta({
				mediaKind: "tv",
				ratingTenths: null,
				liked: true,
			}),
		).toBe("Show · Favorite");
	});
});

describe("RECOMMEND_REASON_OPTIONS", () => {
	test("offers presets that need no shared history", () => {
		expect(RECOMMEND_REASON_OPTIONS.map((o) => o.id)).not.toContain(
			"because_you_liked",
		);
	});
});
