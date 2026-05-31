import { describe, expect, test } from "bun:test";
import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import {
	canReorderRankedList,
	toRankedReorderRows,
} from "@/components/list/list-detail-page-branching";

function buildRow(
	itemId: string,
	kind: "movie" | "tv" | "none" = "movie",
): ListDetailFilmRow {
	return {
		item: {
			id: itemId,
			position: 0,
			note: null,
			movieId: kind === "movie" ? 101 : null,
			tvId: kind === "tv" ? 202 : null,
		},
		movie:
			kind === "movie"
				? { tmdbId: 101, title: "Movie", posterPath: "/m.jpg" }
				: null,
		tv:
			kind === "tv"
				? { tmdbId: 202, title: "Show", posterPath: "/t.jpg" }
				: null,
	};
}

describe("canReorderRankedList", () => {
	test("returns true for ranked list when viewer can edit", () => {
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: "user_1",
				viewerCanEdit: true,
			}),
		).toBe(true);
	});

	test("returns true for invited collaborator when API grants edit", () => {
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: "user_2",
				viewerCanEdit: true,
			}),
		).toBe(true);
	});

	test("returns false for non-ranked or read-only viewers", () => {
		expect(
			canReorderRankedList({
				isRanked: false,
				viewerId: "user_1",
				viewerCanEdit: true,
			}),
		).toBe(false);
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: "viewer",
				viewerCanEdit: false,
			}),
		).toBe(false);
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: null,
				viewerCanEdit: true,
			}),
		).toBe(false);
	});
});

describe("toRankedReorderRows", () => {
	test("keeps rows with stable item ids and a listing payload", () => {
		const rows = [
			buildRow("lit_1", "movie"),
			buildRow("lit_2", "tv"),
			buildRow("", "movie"),
			buildRow("lit_3", "none"),
		];

		const result = toRankedReorderRows(rows);
		expect(result.map((row) => row.item.id)).toEqual(["lit_1", "lit_2"]);
	});
});
