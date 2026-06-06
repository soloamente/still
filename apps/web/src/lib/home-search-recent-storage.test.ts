import { describe, expect, test } from "bun:test";

import {
	type RecentSearchEntryV2,
	readHomeSearchRecents,
	recordHomeSearchRecent,
	refreshRecentSearchTagLabels,
	removeHomeSearchRecent,
	restoreFromHomeSearchRecent,
} from "./home-search-recent-storage";
import { STRUCTURED_QUERY_SEP } from "./search-query-tags";

describe("refreshRecentSearchTagLabels", () => {
	test("updates genre name when catalogue language changes", () => {
		const tags = refreshRecentSearchTagLabels(
			[
				{
					kind: "genre",
					id: 27,
					name: "Horror",
					listingKind: "movie",
				},
			],
			{ movieGenres: [{ id: 27, name: "Terror" }] },
		);
		expect(tags[0]).toEqual({
			kind: "genre",
			id: 27,
			name: "Terror",
			listingKind: "movie",
		});
	});
});

describe("recordHomeSearchRecent", () => {
	test("stores v2 row with localized genre label", () => {
		const entry = recordHomeSearchRecent(
			[{ kind: "genre", id: 27, name: "Terror", listingKind: "movie" }],
			"marty",
			[],
			{ movieGenres: [{ id: 27, name: "Terror" }] },
		)[0];
		expect(entry?.v).toBe(2);
		expect(entry?.label).toBe("Terror · marty");
		expect(entry?.tags[0]).toMatchObject({ id: 27, name: "Terror" });
	});

	test("restore keeps genre id after label refresh", () => {
		const stored: RecentSearchEntryV2 = {
			v: 2,
			label: "Horror · marty",
			freeText: "marty",
			tags: [{ kind: "genre", id: 27, name: "Horror", listingKind: "movie" }],
		};
		const restored = restoreFromHomeSearchRecent(stored, {
			movieGenres: [{ id: 27, name: "Terror" }],
		});
		expect(restored.tags[0]).toEqual({
			kind: "genre",
			id: 27,
			name: "Terror",
			listingKind: "movie",
		});
		expect(restored.freeText).toBe("marty");
	});
});

describe("removeHomeSearchRecent", () => {
	test("drops matching label and persists the rest", () => {
		const store = new Map<string, string>();
		const prevStorage = globalThis.localStorage;
		Object.defineProperty(globalThis, "localStorage", {
			value: {
				getItem: (k: string) => store.get(k) ?? null,
				setItem: (k: string, v: string) => {
					store.set(k, v);
				},
				removeItem: (k: string) => {
					store.delete(k);
				},
			},
			configurable: true,
		});
		try {
			recordHomeSearchRecent([], "alpha", []);
			recordHomeSearchRecent([], "beta", []);
			const next = removeHomeSearchRecent("alpha", []);
			expect(next.map((row) => row.label)).toEqual(["beta"]);
			expect(readHomeSearchRecents([]).map((row) => row.label)).toEqual([
				"beta",
			]);
		} finally {
			if (prevStorage) {
				Object.defineProperty(globalThis, "localStorage", {
					value: prevStorage,
					configurable: true,
				});
			} else {
				Reflect.deleteProperty(globalThis, "localStorage");
			}
		}
	});
});

describe("readHomeSearchRecents", () => {
	test("migrates legacy string rows to v2", () => {
		const store = new Map<string, string>();
		const prevStorage = globalThis.localStorage;
		Object.defineProperty(globalThis, "localStorage", {
			value: {
				getItem: (k: string) => store.get(k) ?? null,
				setItem: (k: string, v: string) => {
					store.set(k, v);
				},
				removeItem: (k: string) => {
					store.delete(k);
				},
			},
			configurable: true,
		});
		try {
			store.set(
				"still.home-search-recent",
				JSON.stringify([`Horror${STRUCTURED_QUERY_SEP}marty`]),
			);
			const rows = readHomeSearchRecents([], {
				movieGenres: [{ id: 27, name: "Horror" }],
			});
			expect(rows[0]?.v).toBe(2);
			expect(rows[0]?.tags.some((t) => t.kind === "genre" && t.id === 27)).toBe(
				true,
			);
		} finally {
			if (prevStorage) {
				Object.defineProperty(globalThis, "localStorage", {
					value: prevStorage,
					configurable: true,
				});
			} else {
				Reflect.deleteProperty(globalThis, "localStorage");
			}
		}
	});
});
