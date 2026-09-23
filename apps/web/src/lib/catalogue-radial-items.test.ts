import { describe, expect, test } from "bun:test";

import {
	buildCatalogueRadialItemSpecs,
	isCatalogueRadialGatedAction,
} from "./catalogue-radial-items";

function ids(
	specs: ReturnType<typeof buildCatalogueRadialItemSpecs>,
): string[] {
	return specs.map((s) => s.id);
}

describe("buildCatalogueRadialItemSpecs", () => {
	test("signed-out — open and copy only", () => {
		expect(
			ids(
				buildCatalogueRadialItemSpecs({
					surface: "home",
					listingKind: "movie",
					signedIn: false,
				}),
			),
		).toEqual(["open", "copy"]);
	});

	test("home signed-in movie — log, watchlist, add to list", () => {
		const specs = buildCatalogueRadialItemSpecs({
			surface: "home",
			listingKind: "movie",
			signedIn: true,
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

	test("home signed-in movie on watchlist — destructive remove label on watchlist slot", () => {
		const wl = buildCatalogueRadialItemSpecs({
			surface: "home",
			listingKind: "movie",
			signedIn: true,
			inWatchlist: true,
		}).find((s) => s.id === "watchlist");
		expect(wl?.label).toBe("Remove from watchlist");
		expect(wl?.variant).toBe("destructive");
	});

	test("home signed-in movie with prior log — Rewatch label", () => {
		const log = buildCatalogueRadialItemSpecs({
			surface: "home",
			listingKind: "movie",
			signedIn: true,
			hasPriorLog: true,
		}).find((s) => s.id === "quick-log");
		expect(log?.label).toBe("Rewatch");
		expect(log?.shortcut).toBe("R");
	});

	test("home signed-in tv — add to list", () => {
		expect(
			ids(
				buildCatalogueRadialItemSpecs({
					surface: "home",
					listingKind: "tv",
					signedIn: true,
				}),
			),
		).toEqual(["open", "copy", "quick-log", "watchlist", "add-to-list"]);
	});

	test("diary with edit — includes edit-log, no quick-log", () => {
		expect(
			ids(
				buildCatalogueRadialItemSpecs({
					surface: "diary",
					listingKind: "movie",
					signedIn: true,
					canEditLog: true,
				}),
			),
		).toEqual(["open", "copy", "edit-log", "add-to-list"]);
	});

	test("watchlist movie — quick log, destructive remove, add to list", () => {
		const specs = buildCatalogueRadialItemSpecs({
			surface: "watchlist",
			listingKind: "movie",
			signedIn: true,
		});
		expect(ids(specs)).toEqual([
			"open",
			"copy",
			"quick-log",
			"add-to-list",
			"remove-watchlist",
		]);
		const remove = specs.find((s) => s.id === "remove-watchlist");
		expect(remove?.variant).toBe("destructive");
	});

	test("taste-rail adds Not interested after add-to-list", () => {
		const specs = buildCatalogueRadialItemSpecs({
			surface: "taste-rail",
			listingKind: "movie",
			signedIn: true,
		});
		expect(ids(specs)).toEqual([
			"open",
			"copy",
			"quick-log",
			"watchlist",
			"add-to-list",
			"not-interested",
		]);
		expect(specs.find((s) => s.id === "not-interested")?.variant).toBe(
			"destructive",
		);
	});

	test("drawer surface matches home lobby actions", () => {
		expect(
			ids(
				buildCatalogueRadialItemSpecs({
					surface: "drawer",
					listingKind: "movie",
					signedIn: true,
					inWatchlist: false,
				}),
			),
		).toEqual(["open", "copy", "quick-log", "watchlist", "add-to-list"]);
	});

	test("home surface does not include not-interested", () => {
		expect(
			ids(
				buildCatalogueRadialItemSpecs({
					surface: "home",
					listingKind: "movie",
					signedIn: true,
				}),
			),
		).not.toContain("not-interested");
	});

	test("watchlist tv — add to list", () => {
		expect(
			ids(
				buildCatalogueRadialItemSpecs({
					surface: "watchlist",
					listingKind: "tv",
					signedIn: true,
				}),
			),
		).toEqual(["open", "copy", "quick-log", "add-to-list", "remove-watchlist"]);
	});
});

describe("watchlist streaming alert slot", () => {
	test("shown on watchlist when not streaming; label flips with state", () => {
		const off = buildCatalogueRadialItemSpecs({
			surface: "watchlist",
			listingKind: "movie",
			signedIn: true,
			streamingAlert: false,
			isStreaming: false,
		});
		expect(off.find((s) => s.id === "streaming-alert")?.label).toBe(
			"Alert me when it streams",
		);
		const on = buildCatalogueRadialItemSpecs({
			surface: "watchlist",
			listingKind: "movie",
			signedIn: true,
			streamingAlert: true,
			isStreaming: false,
		});
		expect(on.find((s) => s.id === "streaming-alert")?.label).toBe(
			"Stop streaming alert",
		);
	});

	test("sits after add-to-list and before destructive remove", () => {
		expect(
			ids(
				buildCatalogueRadialItemSpecs({
					surface: "watchlist",
					listingKind: "tv",
					signedIn: true,
					isStreaming: false,
				}),
			),
		).toEqual([
			"open",
			"copy",
			"quick-log",
			"add-to-list",
			"streaming-alert",
			"remove-watchlist",
		]);
	});

	test("hidden when already streaming or off the watchlist surface", () => {
		expect(
			buildCatalogueRadialItemSpecs({
				surface: "watchlist",
				listingKind: "movie",
				signedIn: true,
				isStreaming: true,
			}).some((s) => s.id === "streaming-alert"),
		).toBe(false);
		expect(
			buildCatalogueRadialItemSpecs({
				surface: "home",
				listingKind: "movie",
				signedIn: true,
			}).some((s) => s.id === "streaming-alert"),
		).toBe(false);
	});

	test("armed alert can always be switched off, even when streaming state is unknown or true", () => {
		for (const isStreaming of [undefined, true, false]) {
			expect(
				buildCatalogueRadialItemSpecs({
					surface: "watchlist",
					listingKind: "movie",
					signedIn: true,
					streamingAlert: true,
					isStreaming,
				}).find((s) => s.id === "streaming-alert")?.label,
			).toBe("Stop streaming alert");
		}
	});

	test("Alert me only when known not streaming", () => {
		expect(
			buildCatalogueRadialItemSpecs({
				surface: "watchlist",
				listingKind: "movie",
				signedIn: true,
				streamingAlert: false,
			}).some((s) => s.id === "streaming-alert"),
		).toBe(false);
	});

	test("hidden for signed-out patrons", () => {
		expect(
			buildCatalogueRadialItemSpecs({
				surface: "watchlist",
				listingKind: "movie",
				signedIn: false,
				isStreaming: false,
			}).some((s) => s.id === "streaming-alert"),
		).toBe(false);
	});
});

describe("isCatalogueRadialGatedAction", () => {
	test("gates everything except open and copy", () => {
		expect(isCatalogueRadialGatedAction("quick-log")).toBe(true);
		expect(isCatalogueRadialGatedAction("open")).toBe(false);
		expect(isCatalogueRadialGatedAction("copy")).toBe(false);
	});
});
