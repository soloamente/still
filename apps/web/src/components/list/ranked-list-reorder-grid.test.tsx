import { describe, expect, test } from "bun:test";
import {
	buildReorderPayloadIds,
	createRankedListReorderController,
	itemIdsFromRows,
	moveRankedRows,
	type RankedListReorderRow,
} from "./ranked-list-reorder-grid";

function row(id: string, tmdbId: number): RankedListReorderRow {
	return {
		item: {
			id,
			position: tmdbId,
			note: null,
			movieId: tmdbId,
			tvId: null,
		},
		movie: { tmdbId, title: `Movie ${tmdbId}`, posterPath: null },
		tv: null,
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

describe("moveRankedRows", () => {
	test("reorders rows with stable item ids", () => {
		const initial = [row("a", 1), row("b", 2), row("c", 3)];
		const reordered = moveRankedRows(initial, "c", "a");
		expect(itemIdsFromRows(reordered)).toEqual(["c", "a", "b"]);
	});
});

describe("buildReorderPayloadIds", () => {
	test("returns visible ids directly when no hidden items exist", () => {
		expect(
			buildReorderPayloadIds({
				reorderedVisibleIds: ["b", "a", "c"],
				allItemIds: ["a", "b", "c"],
			}),
		).toEqual(["b", "a", "c"]);
	});

	test("keeps hidden items in place while reordering visible slots", () => {
		expect(
			buildReorderPayloadIds({
				reorderedVisibleIds: ["c", "a", "d"],
				allItemIds: ["a", "hidden-1", "c", "d", "hidden-2"],
			}),
		).toEqual(["c", "hidden-1", "a", "d", "hidden-2"]);
	});
});

describe("createRankedListReorderController", () => {
	test("optimistically updates order and saves with full ordered item ids", async () => {
		const calls: string[][] = [];
		const pending = deferred<{ ok: boolean }>();
		const controller = createRankedListReorderController({
			listId: "list_1",
			initialRows: [row("a", 1), row("b", 2), row("c", 3)],
			saveOrder: async (_listId, itemIds) => {
				calls.push(itemIds);
				return pending.promise;
			},
		});

		const nextRows = moveRankedRows(controller.readSnapshot().rows, "c", "a");
		const promise = controller.reorder(nextRows);

		const optimistic = controller.readSnapshot();
		expect(optimistic.isSaving).toBe(true);
		expect(itemIdsFromRows(optimistic.rows)).toEqual(["c", "a", "b"]);
		expect(calls).toEqual([["c", "a", "b"]]);

		pending.resolve({ ok: true });
		await promise;
		const committed = controller.readSnapshot();
		expect(committed.isSaving).toBe(false);
		expect(itemIdsFromRows(committed.committedRows)).toEqual(["c", "a", "b"]);
	});

	test("rolls back optimistic order when save fails", async () => {
		const controller = createRankedListReorderController({
			listId: "list_1",
			initialRows: [row("a", 1), row("b", 2), row("c", 3)],
			saveOrder: async () => ({ ok: false }),
		});

		const nextRows = moveRankedRows(controller.readSnapshot().rows, "c", "a");
		await controller.reorder(nextRows);

		expect(itemIdsFromRows(controller.readSnapshot().rows)).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	test("undo restores previous order and persists it", async () => {
		const calls: string[][] = [];
		const controller = createRankedListReorderController({
			listId: "list_1",
			initialRows: [row("a", 1), row("b", 2), row("c", 3)],
			saveOrder: async (_listId, itemIds) => {
				calls.push(itemIds);
				return { ok: true };
			},
		});

		const nextRows = moveRankedRows(controller.readSnapshot().rows, "c", "a");
		await controller.reorder(nextRows);
		expect(itemIdsFromRows(controller.readSnapshot().rows)).toEqual([
			"c",
			"a",
			"b",
		]);

		await controller.undo();
		expect(itemIdsFromRows(controller.readSnapshot().rows)).toEqual([
			"a",
			"b",
			"c",
		]);
		expect(calls).toEqual([
			["c", "a", "b"],
			["a", "b", "c"],
		]);
	});
});
