import { describe, expect, it } from "bun:test";

import {
	arcVisibleSlotCount,
	reorderForCenterArc,
	sliceArcCenterCards,
} from "@/lib/movie-cast-crew-arc";

describe("sliceArcCenterCards", () => {
	it("returns all items when maxVisible covers the row", () => {
		const items = ["a", "b", "c", "d", "e"];
		expect(sliceArcCenterCards(items, 5)).toEqual(items);
		expect(sliceArcCenterCards(items, 11)).toEqual(items);
	});

	it("keeps the center lead when trimming an 11-slot arc row to 5", () => {
		const ordered = reorderForCenterArc(
			["lead", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
			11,
		);
		const centerIndex = Math.floor(ordered.length / 2);

		const sliced = sliceArcCenterCards(ordered, 5);
		expect(sliced).toHaveLength(5);
		expect(sliced[Math.floor(sliced.length / 2)]).toBe("lead");
		expect(sliced).toEqual(ordered.slice(centerIndex - 2, centerIndex + 3));
	});

	it("always returns an odd count when more than one slot remains", () => {
		expect(sliceArcCenterCards(["a", "b", "c", "d", "e", "f"], 4)).toHaveLength(
			arcVisibleSlotCount(6, 4),
		);
	});
});
