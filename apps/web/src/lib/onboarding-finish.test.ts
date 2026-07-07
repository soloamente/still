import { describe, expect, test } from "bun:test";

import { runOnboardingFinish } from "./onboarding-finish";

describe("runOnboardingFinish", () => {
	test("calls avatar upload, logs, profile patch, then recompute", async () => {
		const calls: string[] = [];
		const result = await runOnboardingFinish(
			{
				avatarFile: new File(["x"], "a.png", { type: "image/png" }),
				tasteRatings: { 550: 80, 278: 90 },
				handle: "patron",
				displayName: "Patron",
				bio: "Hello",
				favoriteMovieIds: [550, 680],
			},
			{
				uploadAvatar: async () => {
					calls.push("avatar");
				},
				postLog: async (movieId, rating, options) => {
					calls.push(
						`log:${movieId}:${rating ?? "none"}:${options?.liked ? "liked" : "plain"}`,
					);
				},
				patchProfile: async () => {
					calls.push("profile");
					return {};
				},
				recomputeTaste: async () => {
					calls.push("taste");
					return { headline: "You gravitate toward drama." };
				},
			},
		);

		expect(calls).toEqual([
			"avatar",
			"log:278:90:plain",
			"log:550:80:plain",
			"log:680:none:liked",
			"profile",
			"taste",
		]);
		expect(result.headline).toBe("You gravitate toward drama.");
	});

	test("skips avatar upload when no file staged", async () => {
		const calls: string[] = [];
		await runOnboardingFinish(
			{
				avatarFile: null,
				tasteRatings: { 550: 80 },
				handle: "patron",
				displayName: "Patron",
				bio: "",
				favoriteMovieIds: [550],
			},
			{
				uploadAvatar: async () => {
					calls.push("avatar");
				},
				postLog: async (movieId, rating, options) => {
					calls.push(
						`log:${movieId}:${rating ?? "none"}:${options?.liked ? "liked" : "plain"}`,
					);
				},
				patchProfile: async () => {
					calls.push("profile");
					return {};
				},
				recomputeTaste: async () => {
					calls.push("taste");
					return {};
				},
			},
		);

		expect(calls).toEqual(["log:550:80:plain", "profile", "taste"]);
	});
});
