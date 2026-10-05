import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";

import { watchlistProvidersTmdbJsonForRegion } from "./watchlist-lobby-tmdb-json";
import { primaryFlatrateProviderName } from "./watchlist-streaming-alerts";

describe("watchlistProvidersTmdbJsonForRegion", () => {
	test("binds the region as a parameter and scopes to that country", () => {
		const query = new PgDialect().sqlToQuery(
			watchlistProvidersTmdbJsonForRegion("gb"),
		);
		// Region key, movie/tv provider lookups, and the release-date country filter.
		expect(query.params).toEqual(["GB", "GB", "GB", "GB"]);
		expect(query.sql).not.toContain("GB");
		expect(query.sql).toContain("'watch/providers' -> 'results' ->");
		expect(query.sql).toContain("coalesce(");
	});

	test("hostile region input stays a parameter", () => {
		const query = new PgDialect().sqlToQuery(
			watchlistProvidersTmdbJsonForRegion("x'); drop table movie; --"),
		);
		expect(query.sql).not.toContain("drop table");
	});

	test("projected shape satisfies primaryFlatrateProviderName", () => {
		const projected = {
			"watch/providers": {
				results: {
					GB: {
						flatrate: [{ provider_id: 8, provider_name: "Netflix" }],
					},
				},
			},
		};
		expect(primaryFlatrateProviderName(projected, "GB")).toBe("Netflix");
		// Country missing from the cache → SQL yields `{ GB: null }`.
		expect(
			primaryFlatrateProviderName(
				{ "watch/providers": { results: { GB: null } } },
				"GB",
			),
		).toBeNull();
	});
});
