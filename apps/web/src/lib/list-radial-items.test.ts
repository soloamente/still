import { describe, expect, test } from "bun:test";

import {
	buildListRadialItemSpecs,
	isListRadialGatedAction,
} from "./list-radial-items";

function ids(specs: ReturnType<typeof buildListRadialItemSpecs>): string[] {
	return specs.map((s) => s.id);
}

describe("buildListRadialItemSpecs", () => {
	test("signed-out — open and copy only", () => {
		expect(
			ids(
				buildListRadialItemSpecs({
					signedIn: false,
					listingKind: "movie",
					hasPriorLog: false,
					liked: false,
					canEditMembership: false,
					isFavoritesList: false,
				}),
			),
		).toEqual(["open", "copy"]);
	});

	test("signed-in, no log — quick log only beyond open/copy", () => {
		expect(
			ids(
				buildListRadialItemSpecs({
					signedIn: true,
					listingKind: "movie",
					hasPriorLog: false,
					liked: false,
					canEditMembership: false,
					isFavoritesList: false,
				}),
			),
		).toEqual(["open", "copy", "quick-log"]);
	});

	test("signed-in with log, not liked — add to list and add to favorites", () => {
		const specs = buildListRadialItemSpecs({
			signedIn: true,
			listingKind: "movie",
			hasPriorLog: true,
			liked: false,
			canEditMembership: false,
			isFavoritesList: false,
		});
		expect(ids(specs)).toEqual([
			"open",
			"copy",
			"quick-log",
			"edit-log",
			"add-to-list",
			"toggle-favorite",
		]);
		expect(specs.find((s) => s.id === "toggle-favorite")?.label).toBe(
			"Add to favorites",
		);
	});

	test("signed-in with log, liked — remove from favorites is destructive", () => {
		const fav = buildListRadialItemSpecs({
			signedIn: true,
			listingKind: "tv",
			hasPriorLog: true,
			liked: true,
			canEditMembership: false,
			isFavoritesList: true,
		}).find((s) => s.id === "toggle-favorite");
		expect(fav?.label).toBe("Remove from favorites");
		expect(fav?.variant).toBe("destructive");
	});

	test("editor on custom list — remove from list", () => {
		expect(
			ids(
				buildListRadialItemSpecs({
					signedIn: true,
					listingKind: "movie",
					hasPriorLog: true,
					liked: true,
					canEditMembership: true,
					isFavoritesList: false,
				}),
			),
		).toEqual([
			"open",
			"copy",
			"quick-log",
			"edit-log",
			"add-to-list",
			"toggle-favorite",
			"remove-from-list",
		]);
	});

	test("profile signed-in without log — watchlist and add to list (home parity)", () => {
		const specs = buildListRadialItemSpecs({
			signedIn: true,
			listingKind: "movie",
			hasPriorLog: false,
			liked: false,
			canEditMembership: false,
			isFavoritesList: false,
			context: "profile",
			inWatchlist: false,
		});
		expect(ids(specs)).toEqual([
			"open",
			"copy",
			"quick-log",
			"watchlist",
			"add-to-list",
		]);
		expect(specs.find((s) => s.id === "watchlist")?.label).toBe(
			"Add to watchlist",
		);
	});

	test("profile with log and watchlisted — edit, remove watchlist, favorites", () => {
		const specs = buildListRadialItemSpecs({
			signedIn: true,
			listingKind: "tv",
			hasPriorLog: true,
			liked: false,
			canEditMembership: false,
			isFavoritesList: false,
			context: "profile",
			inWatchlist: true,
		});
		expect(ids(specs)).toEqual([
			"open",
			"copy",
			"quick-log",
			"edit-log",
			"watchlist",
			"add-to-list",
			"toggle-favorite",
		]);
		expect(specs.find((s) => s.id === "watchlist")?.label).toBe(
			"Remove from watchlist",
		);
		expect(specs.find((s) => s.id === "watchlist")?.variant).toBe(
			"destructive",
		);
	});

	test("favorites list editor flag does not expose remove-from-list", () => {
		expect(
			ids(
				buildListRadialItemSpecs({
					signedIn: true,
					listingKind: "movie",
					hasPriorLog: true,
					liked: true,
					canEditMembership: true,
					isFavoritesList: true,
				}),
			),
		).not.toContain("remove-from-list");
	});
});

describe("isListRadialGatedAction", () => {
	test("gates everything except open and copy", () => {
		expect(isListRadialGatedAction("quick-log")).toBe(true);
		expect(isListRadialGatedAction("open")).toBe(false);
		expect(isListRadialGatedAction("copy")).toBe(false);
	});
});
