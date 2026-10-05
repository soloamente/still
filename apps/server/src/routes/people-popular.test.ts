import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

import { peopleRoute } from "./people";

mock.module("../lib/tmdb", () => ({
	tmdbApi: {
		personPopular: async () => ({
			results: [
				{
					id: 1,
					name: "Test Patron",
					profile_path: null,
					known_for_department: "Acting",
					known_for: [],
					popularity: 1,
				},
			],
			page: 1,
			total_pages: 1,
			total_results: 1,
		}),
	},
	tmdbImg: {
		profile: () => null,
	},
}));

mock.module("@still/env/server", () => ({
	env: { TMDB_API_KEY: "test-key" },
}));

mock.module("../context", () => ({
	context: new Elysia().derive(() => ({ user: null })),
}));

mock.module("../lib/person-search-traffic", () => ({
	listTopPersonSearchTraffic: async () => [],
	getPersonSearchTrafficCounts: async () => new Map(),
	incrementPersonSearchTraffic: async () => {},
}));

mock.module("../lib/person-favorite", () => ({
	listFavoritedPersonIdsAmong: async () => new Set<number>(),
}));

mock.module("../lib/tmdb-poster-language", () => ({
	getTmdbLanguageForUser: async () => "en-US",
}));

mock.module("../lib/adult-content-user-pref", () => ({
	getShowAdultContentForUser: async () => false,
}));

mock.module("../lib/search-dialog-trending-cast-people", () => ({
	loadSearchDialogTrendingCastPeople: async () => [],
}));

describe("GET /api/people/popular", () => {
	test("accepts media=people query (search dialog People tab)", async () => {
		const app = new Elysia().use(peopleRoute);
		const res = await app.handle(
			new Request("http://localhost/api/people/popular?media=people"),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { results?: { name: string }[] };
		expect(body.results?.[0]?.name).toBe("Test Patron");
	});
});
