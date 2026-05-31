import { describe, expect, test } from "bun:test";

import {
	listBoardRowPosterUrl,
	listPosterDisplayUrl,
} from "@/lib/list-cover-image";

describe("listPosterDisplayUrl", () => {
	test("proxies Vercel Blob paths instead of prefixing TMDb", () => {
		const blob =
			"https://example.private.blob.vercel-storage.com/list-covers/lst_abc/cover.png";
		const url = listPosterDisplayUrl("lst_abc", blob, 123, "w185");
		expect(url).toContain("/api/lists/lst_abc/cover-image");
		expect(url).not.toContain("image.tmdb.org");
	});

	test("builds TMDb URL for fragment paths", () => {
		expect(listPosterDisplayUrl("lst_x", "/abc.jpg", undefined, "w185")).toBe(
			"https://image.tmdb.org/t/p/w185/abc.jpg",
		);
	});
});

describe("listBoardRowPosterUrl", () => {
	test("prefers coverImageUrl over coverPosterPaths", () => {
		const blob = "https://example.private.blob.vercel-storage.com/cover.png";
		const url = listBoardRowPosterUrl({
			id: "lst_1",
			coverImageUrl: blob,
			coverPosterPaths: ["/tmdb-only.jpg"],
			updatedAt: "2026-01-01T00:00:00.000Z",
		});
		expect(url).toContain("/api/lists/lst_1/cover-image");
	});
});
