import { describe, expect, it } from "bun:test";

import { canViewContent } from "./content-visibility";

const base = {
	authorId: "author",
	viewerFollowsAuthor: false,
	viewerIsMutual: false,
};

describe("canViewContent", () => {
	it("shows public content to anyone, including anonymous", () => {
		expect(
			canViewContent({ ...base, viewerId: null, visibility: "public" }),
		).toBe(true);
		expect(
			canViewContent({ ...base, viewerId: "stranger", visibility: "public" }),
		).toBe(true);
	});

	it("always shows authors their own content, any tier", () => {
		for (const visibility of [
			"public",
			"followers",
			"friends",
			"private",
		] as const) {
			expect(canViewContent({ ...base, viewerId: "author", visibility })).toBe(
				true,
			);
		}
	});

	it("hides private from everyone but the author", () => {
		expect(
			canViewContent({ ...base, viewerId: "stranger", visibility: "private" }),
		).toBe(false);
		expect(
			canViewContent({
				...base,
				viewerId: "follower",
				visibility: "private",
				viewerFollowsAuthor: true,
				viewerIsMutual: true,
			}),
		).toBe(false);
	});

	it("followers tier needs a one-way follow", () => {
		expect(
			canViewContent({
				...base,
				viewerId: "f",
				visibility: "followers",
				viewerFollowsAuthor: true,
			}),
		).toBe(true);
		expect(
			canViewContent({ ...base, viewerId: "f", visibility: "followers" }),
		).toBe(false);
		expect(
			canViewContent({ ...base, viewerId: null, visibility: "followers" }),
		).toBe(false);
	});

	it("friends tier needs a mutual follow; a one-way follower is denied", () => {
		expect(
			canViewContent({
				...base,
				viewerId: "m",
				visibility: "friends",
				viewerFollowsAuthor: true,
				viewerIsMutual: true,
			}),
		).toBe(true);
		expect(
			canViewContent({
				...base,
				viewerId: "f",
				visibility: "friends",
				viewerFollowsAuthor: true,
				viewerIsMutual: false,
			}),
		).toBe(false);
	});
});
