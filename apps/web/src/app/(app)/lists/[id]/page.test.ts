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
	test("returns true for ranked owner list", () => {
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: "user_1",
				ownerId: "user_1",
				isCollaborative: false,
			}),
		).toBe(true);
	});

	test("returns true for ranked collaborative list with signed-in non-owner", () => {
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: "user_2",
				ownerId: "user_1",
				isCollaborative: true,
			}),
		).toBe(true);
	});

	test("returns false for non-ranked or read-only viewers", () => {
		expect(
			canReorderRankedList({
				isRanked: false,
				viewerId: "user_1",
				ownerId: "user_1",
				isCollaborative: true,
			}),
		).toBe(false);
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: "viewer",
				ownerId: "owner",
				isCollaborative: false,
			}),
		).toBe(false);
		expect(
			canReorderRankedList({
				isRanked: true,
				viewerId: null,
				ownerId: "owner",
				isCollaborative: true,
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
