import { describe, expect, test } from "bun:test";

import {
	type PersonFavoriteCreditScanRow,
	planPersonFavoriteReleaseDiff,
	resolvePersonFavoriteReleaseActions,
} from "./person-favorite-release-alerts";

const now = new Date("2026-09-21T15:00:00.000Z");

function credit(
	overrides: Partial<PersonFavoriteCreditScanRow> &
		Pick<PersonFavoriteCreditScanRow, "tmdbId" | "mediaKind" | "role">,
): PersonFavoriteCreditScanRow {
	return {
		title: "Title",
		releaseDate: "2026-09-21",
		...overrides,
	};
}

describe("planPersonFavoriteReleaseDiff", () => {
	test("in-window unseen credit becomes notify", () => {
		const plan = planPersonFavoriteReleaseDiff({
			credits: [
				credit({
					mediaKind: "movie",
					tmdbId: 10,
					role: { kind: "crew", job: "Director" },
					title: "Dune",
					releaseDate: "2026-10-01",
				}),
			],
			seenKeys: new Set(),
			now,
		});
		expect(plan.notify).toHaveLength(1);
		expect(plan.notify[0]).toMatchObject({
			mediaKind: "movie",
			tmdbId: 10,
			roleKey: "crew:director",
			roleLabel: "directed",
			title: "Dune",
			releaseDate: "2026-10-01",
		});
		expect(plan.markSeenSilent).toHaveLength(0);
	});

	test("outside window marks seen silently without notify", () => {
		const plan = planPersonFavoriteReleaseDiff({
			credits: [
				credit({
					mediaKind: "movie",
					tmdbId: 11,
					role: { kind: "cast", character: "Paul" },
					releaseDate: "2027-01-01",
				}),
			],
			seenKeys: new Set(),
			now,
		});
		expect(plan.notify).toHaveLength(0);
		expect(plan.markSeenSilent).toHaveLength(1);
		expect(plan.markSeenSilent[0]?.roleKey).toBe("cast:paul");
	});

	test("unknown release date marks seen silently", () => {
		const plan = planPersonFavoriteReleaseDiff({
			credits: [
				credit({
					mediaKind: "tv",
					tmdbId: 12,
					role: { kind: "crew", job: "Writer" },
					releaseDate: null,
				}),
			],
			seenKeys: new Set(),
			now,
		});
		expect(plan.notify).toHaveLength(0);
		expect(plan.markSeenSilent).toHaveLength(1);
	});

	test("already seen credits are skipped entirely", () => {
		const plan = planPersonFavoriteReleaseDiff({
			credits: [
				credit({
					mediaKind: "movie",
					tmdbId: 10,
					role: { kind: "crew", job: "Director" },
					releaseDate: "2026-10-01",
				}),
			],
			seenKeys: new Set(["movie:10:crew:director"]),
			now,
		});
		expect(plan.notify).toHaveLength(0);
		expect(plan.markSeenSilent).toHaveLength(0);
	});

	test("seenKeyForCredit is stable for cast and crew", () => {
		const plan = planPersonFavoriteReleaseDiff({
			credits: [
				credit({
					mediaKind: "movie",
					tmdbId: 1,
					role: { kind: "cast", character: "Ada" },
					releaseDate: "2020-01-01",
				}),
			],
			seenKeys: new Set(),
			now,
		});
		expect(plan.markSeenSilent[0]?.roleKey).toBe("cast:ada");
	});
});

describe("resolvePersonFavoriteReleaseActions", () => {
	test("pref off still marks in-window credits seen without notify (no storm later)", () => {
		const plan = planPersonFavoriteReleaseDiff({
			credits: [
				credit({
					mediaKind: "movie",
					tmdbId: 10,
					role: { kind: "crew", job: "Director" },
					title: "Dune",
					releaseDate: "2026-10-01",
				}),
				credit({
					mediaKind: "movie",
					tmdbId: 11,
					role: { kind: "cast", character: "Paul" },
					releaseDate: "2027-01-01",
				}),
			],
			seenKeys: new Set(),
			now,
		});
		expect(plan.notify).toHaveLength(1);
		expect(plan.markSeenSilent).toHaveLength(1);

		const actions = resolvePersonFavoriteReleaseActions({
			plan,
			prefsAllowNotify: false,
		});
		expect(actions.notify).toHaveLength(0);
		expect(actions.markSeen).toHaveLength(2);
	});

	test("pref on notifies in-window and marks all planned credits seen", () => {
		const plan = planPersonFavoriteReleaseDiff({
			credits: [
				credit({
					mediaKind: "movie",
					tmdbId: 10,
					role: { kind: "crew", job: "Director" },
					releaseDate: "2026-10-01",
				}),
			],
			seenKeys: new Set(),
			now,
		});
		const actions = resolvePersonFavoriteReleaseActions({
			plan,
			prefsAllowNotify: true,
		});
		expect(actions.notify).toHaveLength(1);
		expect(actions.markSeen).toHaveLength(1);
	});
});
