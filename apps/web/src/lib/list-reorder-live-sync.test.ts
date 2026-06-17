import { describe, expect, test } from "bun:test";

import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import {
	filmRowOrderKey,
	sortFilmRowsByItemIds,
} from "@/lib/list-reorder-live-sync";

function row(id: string): ListDetailFilmRow {
	return {
		item: {
			id,
			position: 0,
			note: null,
			movieId: 1,
			tvId: null,
		},
		movie: { tmdbId: 1, title: "Film", posterPath: null },
		tv: null,
		ownerLog: null,
	};
}

describe("list-reorder-live-sync", () => {
	test("sortFilmRowsByItemIds reorders visible rows", () => {
		const rows = [row("lit_a"), row("lit_b"), row("lit_c")];
		expect(
			sortFilmRowsByItemIds(rows, ["lit_c", "lit_a", "lit_b"]).map(
				(entry) => entry.item.id,
			),
		).toEqual(["lit_c", "lit_a", "lit_b"]);
	});

	test("filmRowOrderKey tracks id order", () => {
		expect(filmRowOrderKey([row("lit_a"), row("lit_b")])).toBe(
			"lit_a\u0001lit_b",
		);
	});
});
