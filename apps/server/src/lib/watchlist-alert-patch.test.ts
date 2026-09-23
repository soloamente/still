import { describe, expect, mock, test } from "bun:test";

import {
	handleWatchlistAlertPatch,
	type WatchlistAlertPatchDeps,
	type WatchlistAlertPreviewPayload,
} from "./watchlist-alert-patch";

const PREVIEW: WatchlistAlertPreviewPayload = {
	notStreamingCount: 2,
	sample: [
		{ listingKind: "movie", tmdbId: 5, title: "Heat", posterPath: null },
	],
};

/** Fakes with call tracking; defaults = Attuned patron, region IT, row exists. */
function makeDeps(overrides: {
	region?: string | null;
	hasFeature?: boolean;
	rowExists?: boolean;
}) {
	const region = "region" in overrides ? overrides.region : "IT";
	const deps = {
		loadChosenRegion: mock(async () => region ?? null),
		hasAlertsFeature: mock(async () => overrides.hasFeature ?? true),
		loadPreview: mock(async () => PREVIEW),
		setAlert: mock(async () => overrides.rowExists ?? true),
		onUpdated: mock(async () => {}),
	} satisfies WatchlistAlertPatchDeps;
	return deps;
}

describe("PATCH /api/watchlist/alert decision", () => {
	test("401 when signed out, nothing touched", async () => {
		const deps = makeDeps({});
		const res = await handleWatchlistAlertPatch(
			{ userId: null, body: { movieId: 5, enabled: true } },
			deps,
		);
		expect(res.status).toBe(401);
		expect(deps.setAlert).not.toHaveBeenCalled();
	});

	test("400 when both or neither id is sent", async () => {
		const deps = makeDeps({});
		const both = await handleWatchlistAlertPatch(
			{ userId: "u", body: { movieId: 5, tvId: 7, enabled: true } },
			deps,
		);
		const neither = await handleWatchlistAlertPatch(
			{ userId: "u", body: { enabled: false } },
			deps,
		);
		expect(both.status).toBe(400);
		expect(neither.status).toBe(400);
		expect(deps.setAlert).not.toHaveBeenCalled();
	});

	test("403 plan gate returns the preview and updates nothing", async () => {
		const deps = makeDeps({ hasFeature: false });
		const res = await handleWatchlistAlertPatch(
			{ userId: "u", body: { tvId: 7, enabled: true } },
			deps,
		);
		expect(res.status).toBe(403);
		expect(res.body).toMatchObject({
			code: "PLAN_FEATURE_REQUIRED",
			featureKey: "watchlist_alerts",
			preview: PREVIEW,
		});
		// Preview is counted in the patron's chosen region.
		expect(deps.loadPreview).toHaveBeenCalledWith("u", "IT");
		expect(deps.setAlert).not.toHaveBeenCalled();
		expect(deps.onUpdated).not.toHaveBeenCalled();
	});

	test("disabling without the feature succeeds (post-downgrade)", async () => {
		const deps = makeDeps({ hasFeature: false, region: null });
		const res = await handleWatchlistAlertPatch(
			{ userId: "u", body: { movieId: 5, enabled: false } },
			deps,
		);
		expect(res).toEqual({ status: 200, body: { ok: true, enabled: false } });
		expect(deps.hasAlertsFeature).not.toHaveBeenCalled();
		expect(deps.setAlert).toHaveBeenCalledWith(
			"u",
			{ listingKind: "movie", tmdbId: 5 },
			false,
		);
		expect(deps.onUpdated).toHaveBeenCalledTimes(1);
	});

	test("404 when the title isn't on the watchlist", async () => {
		const deps = makeDeps({ rowExists: false });
		const res = await handleWatchlistAlertPatch(
			{ userId: "u", body: { movieId: 5, enabled: true } },
			deps,
		);
		expect(res.status).toBe(404);
		expect(deps.onUpdated).not.toHaveBeenCalled();
	});

	test("409 NEEDS_REGION when enabling with the feature but no region", async () => {
		const deps = makeDeps({ region: null, hasFeature: true });
		const res = await handleWatchlistAlertPatch(
			{ userId: "u", body: { movieId: 5, enabled: true } },
			deps,
		);
		expect(res.status).toBe(409);
		expect(res.body).toMatchObject({ code: "NEEDS_REGION" });
		expect(deps.setAlert).not.toHaveBeenCalled();
	});

	test("enabling with feature + region updates and runs side effects", async () => {
		const deps = makeDeps({});
		const res = await handleWatchlistAlertPatch(
			{ userId: "u", body: { tvId: 7, enabled: true } },
			deps,
		);
		expect(res).toEqual({ status: 200, body: { ok: true, enabled: true } });
		expect(deps.setAlert).toHaveBeenCalledWith(
			"u",
			{ listingKind: "tv", tmdbId: 7 },
			true,
		);
		expect(deps.onUpdated).toHaveBeenCalledWith(
			"u",
			{ listingKind: "tv", tmdbId: 7 },
			true,
		);
	});
});
