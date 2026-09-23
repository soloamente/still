import { describe, expect, test } from "bun:test";

import {
	buildRecommendationNotification,
	canRecommendBetween,
	normalizeRecommendationNote,
	parseRecommendationReasonCode,
	type RecommendationSuggestionCandidate,
	rankRecommendationSuggestions,
	recommendationHref,
	titleKey,
} from "./title-recommendation";

function candidate(
	partial: Partial<RecommendationSuggestionCandidate> & { tmdbId: number },
): RecommendationSuggestionCandidate {
	return {
		mediaKind: "movie",
		title: `Title ${partial.tmdbId}`,
		posterPath: null,
		ratingTenths: 80,
		liked: false,
		loggedAt: new Date("2026-09-01T00:00:00Z"),
		sensitive: false,
		...partial,
	};
}

describe("rankRecommendationSuggestions", () => {
	test("returns at most three, highest sender score first", () => {
		const out = rankRecommendationSuggestions({
			candidates: [
				candidate({ tmdbId: 1, ratingTenths: 70 }),
				candidate({ tmdbId: 2, ratingTenths: 95 }),
				candidate({ tmdbId: 3, ratingTenths: 90 }),
				candidate({ tmdbId: 4, ratingTenths: 85 }),
			],
			recipientVisibleWatchedKeys: new Set(),
			alreadyRecommendedKeys: new Set(),
		});
		expect(out.map((s) => s.tmdbId)).toEqual([2, 3, 4]);
	});

	test("dedupes repeat logs of the same title (keeps the best score)", () => {
		const out = rankRecommendationSuggestions({
			candidates: [
				candidate({ tmdbId: 1, ratingTenths: 60 }),
				candidate({ tmdbId: 1, ratingTenths: 90 }),
				candidate({ tmdbId: 2, ratingTenths: 80 }),
			],
			recipientVisibleWatchedKeys: new Set(),
			alreadyRecommendedKeys: new Set(),
		});
		expect(out.map((s) => [s.tmdbId, s.ratingTenths])).toEqual([
			[1, 90],
			[2, 80],
		]);
	});

	test("film and show with the same TMDb id are different titles", () => {
		const out = rankRecommendationSuggestions({
			candidates: [
				candidate({ tmdbId: 7, mediaKind: "movie" }),
				candidate({ tmdbId: 7, mediaKind: "tv" }),
			],
			recipientVisibleWatchedKeys: new Set(),
			alreadyRecommendedKeys: new Set(),
		});
		expect(out).toHaveLength(2);
	});

	test("already-watched flag only comes from the visible set, and those sink below fresh picks", () => {
		const out = rankRecommendationSuggestions({
			candidates: [
				candidate({ tmdbId: 1, ratingTenths: 100 }),
				candidate({ tmdbId: 2, ratingTenths: 70 }),
			],
			recipientVisibleWatchedKeys: new Set([titleKey("movie", 1)]),
			alreadyRecommendedKeys: new Set(),
		});
		expect(out.map((s) => [s.tmdbId, s.alreadyWatchedVisible])).toEqual([
			[2, false],
			[1, true],
		]);
	});

	test("skips titles the sender already recommended to this patron", () => {
		const out = rankRecommendationSuggestions({
			candidates: [candidate({ tmdbId: 1 }), candidate({ tmdbId: 2 })],
			recipientVisibleWatchedKeys: new Set(),
			alreadyRecommendedKeys: new Set([titleKey("movie", 1)]),
		});
		expect(out.map((s) => s.tmdbId)).toEqual([2]);
	});

	test("favorites break score ties", () => {
		const out = rankRecommendationSuggestions({
			candidates: [
				candidate({ tmdbId: 1, ratingTenths: 80 }),
				candidate({ tmdbId: 2, ratingTenths: 80, liked: true }),
			],
			recipientVisibleWatchedKeys: new Set(),
			alreadyRecommendedKeys: new Set(),
		});
		expect(out[0]?.tmdbId).toBe(2);
	});
});

describe("canRecommendBetween", () => {
	const base = {
		senderId: "a",
		recipientId: "b",
		senderFollowsRecipient: true,
		recipientFollowsSender: false,
		blocked: false,
		recipientBanned: false,
	};

	test("a follow in either direction is enough", () => {
		expect(canRecommendBetween(base)).toEqual({ ok: true });
		expect(
			canRecommendBetween({
				...base,
				senderFollowsRecipient: false,
				recipientFollowsSender: true,
			}),
		).toEqual({ ok: true });
	});

	test("strangers, self, blocks and banned recipients are refused", () => {
		expect(
			canRecommendBetween({ ...base, senderFollowsRecipient: false }),
		).toEqual({ ok: false, reason: "not_connected" });
		expect(canRecommendBetween({ ...base, recipientId: "a" })).toEqual({
			ok: false,
			reason: "self",
		});
		expect(canRecommendBetween({ ...base, blocked: true })).toEqual({
			ok: false,
			reason: "unavailable",
		});
		expect(canRecommendBetween({ ...base, recipientBanned: true })).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});

describe("normalizeRecommendationNote", () => {
	test("trims, empties to null, caps at 280", () => {
		expect(normalizeRecommendationNote(undefined)).toEqual({
			ok: true,
			note: null,
		});
		expect(normalizeRecommendationNote("   ")).toEqual({
			ok: true,
			note: null,
		});
		expect(normalizeRecommendationNote("  so good ")).toEqual({
			ok: true,
			note: "so good",
		});
		expect(normalizeRecommendationNote("x".repeat(281))).toEqual({
			ok: false,
		});
	});
});

describe("parseRecommendationReasonCode", () => {
	test("known codes pass, everything else is null", () => {
		expect(parseRecommendationReasonCode("hidden_gem")).toBe("hidden_gem");
		expect(parseRecommendationReasonCode("nope")).toBeNull();
		expect(parseRecommendationReasonCode(undefined)).toBeNull();
	});
});

describe("recommendationHref", () => {
	test("film and show detail with the recommendation id for open tracking", () => {
		expect(recommendationHref("movie", 603, "rec_1")).toBe(
			"/movies/603?recommend=rec_1",
		);
		expect(recommendationHref("tv", 1399, "rec_2")).toBe(
			"/tv/1399?recommend=rec_2",
		);
	});
});

describe("buildRecommendationNotification", () => {
	const input = {
		recommendationId: "rec_1",
		senderUserId: "a",
		senderName: "Anselmo",
		mediaKind: "movie" as const,
		tmdbId: 603,
		title: "The Matrix",
		posterPath: "/p.jpg",
		reasonCode: "hidden_gem" as const,
		note: null,
		sensitive: false,
	};

	test("names the sender and title, reason in the body", () => {
		const out = buildRecommendationNotification(input);
		expect(out.title).toBe("Anselmo thinks you’d like The Matrix");
		expect(out.body).toBe("Hidden gem");
		expect(out.payload).toMatchObject({
			recommendationId: "rec_1",
			fromUserId: "a",
			movieId: 603,
			mediaKind: "movie",
			posterPath: "/p.jpg",
			href: "/movies/603?recommend=rec_1",
		});
	});

	test("the sender's note wins over the preset reason in the body", () => {
		const out = buildRecommendationNotification({
			...input,
			note: "watch it tonight",
		});
		expect(out.body).toBe("“watch it tonight”");
	});

	test("sensitive sends scrub title, artwork and note from the preview", () => {
		const out = buildRecommendationNotification({
			...input,
			note: "wild one",
			sensitive: true,
		});
		expect(out.title).toBe("Anselmo sent you a recommendation");
		expect(out.body).toBeNull();
		expect(out.payload.posterPath).toBeNull();
		expect(out.payload.sensitive).toBe(true);
		expect(JSON.stringify(out)).not.toContain("The Matrix");
		expect(JSON.stringify(out)).not.toContain("wild one");
		// The deep link still works — the recipient's own prefs apply on the title page.
		expect(out.payload.href).toBe("/movies/603?recommend=rec_1");
	});

	test("TV payloads carry tvId, not movieId", () => {
		const out = buildRecommendationNotification({
			...input,
			mediaKind: "tv",
			tmdbId: 1399,
		});
		expect(out.payload.tvId).toBe(1399);
		expect("movieId" in out.payload).toBe(false);
	});
});
