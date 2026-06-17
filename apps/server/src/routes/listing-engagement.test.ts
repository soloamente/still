import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const fetchListingEngagementWatches = mock(async () => ({
	items: [],
	page: 1,
	hasMore: false,
	totalVisible: 0,
	totalGlobal: 0,
}));
const fetchListingEngagementLists = mock(async () => ({
	items: [],
	page: 1,
	hasMore: false,
	totalVisible: 0,
	totalGlobal: 0,
}));
const fetchListingEngagementFavorites = mock(async () => ({
	items: [],
	page: 1,
	hasMore: false,
	totalVisible: 0,
	totalGlobal: 0,
}));
const fetchListingEngagementWatchlist = mock(async () => ({
	items: [],
	page: 1,
	hasMore: false,
	totalVisible: 0,
	totalGlobal: 0,
}));
const fetchListingCommunityEngagementStats = mock(async () => ({
	watchesCount: 3,
	listsCount: 1,
	favoritesCount: 2,
	watchlistCount: 4,
}));

mock.module("../lib/listing-engagement-query", () => ({
	fetchListingEngagementWatches,
	fetchListingEngagementLists,
	fetchListingEngagementFavorites,
	fetchListingEngagementWatchlist,
}));

mock.module("../lib/listing-community-stats", () => ({
	fetchListingCommunityEngagementStats,
}));

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				if (!id) return null;
				return {
					session: { id: `session-${id}` },
					user: { id, name: "Patron" },
				};
			},
		},
		handler: () => new Response("ok"),
	},
}));

const { context } = await import("../context");
const { movieListingEngagementRoutes } = await import("./listing-engagement");

function makeMovieApp() {
	return new Elysia({ prefix: "/api/movies" })
		.use(context)
		.use(movieListingEngagementRoutes);
}

describe("listing engagement routes", () => {
	beforeEach(() => {
		fetchListingEngagementWatches.mockClear();
		fetchListingEngagementLists.mockClear();
		fetchListingEngagementFavorites.mockClear();
		fetchListingEngagementWatchlist.mockClear();
		fetchListingCommunityEngagementStats.mockClear();
	});

	test("GET watches returns 401 when unsigned", async () => {
		const res = await makeMovieApp().handle(
			new Request("http://localhost/api/movies/550/engagement/watches"),
		);
		expect(res.status).toBe(401);
	});

	test("GET watches returns 400 for invalid id", async () => {
		const res = await makeMovieApp().handle(
			new Request("http://localhost/api/movies/abc/engagement/watches", {
				headers: { "x-user-id": "usr_1" },
			}),
		);
		expect(res.status).toBe(400);
	});

	test("GET watches happy path forwards viewer + listing", async () => {
		const res = await makeMovieApp().handle(
			new Request(
				"http://localhost/api/movies/550/engagement/watches?page=2&limit=10",
				{ headers: { "x-user-id": "usr_1" } },
			),
		);
		expect(res.status).toBe(200);
		expect(fetchListingEngagementWatches).toHaveBeenCalledWith({
			listing: { movieId: 550 },
			viewerId: "usr_1",
			page: "2",
			limit: "10",
		});
		const body = (await res.json()) as { items: unknown[] };
		expect(Array.isArray(body.items)).toBe(true);
	});

	test("GET lists uses lists query helper", async () => {
		await makeMovieApp().handle(
			new Request("http://localhost/api/movies/12/engagement/lists", {
				headers: { "x-user-id": "usr_2" },
			}),
		);
		expect(fetchListingEngagementLists).toHaveBeenCalledTimes(1);
	});

	test("GET summary returns engagement totals for signed-in patrons", async () => {
		const res = await makeMovieApp().handle(
			new Request("http://localhost/api/movies/550/engagement/summary", {
				headers: { "x-user-id": "usr_1" },
			}),
		);
		expect(res.status).toBe(200);
		expect(fetchListingCommunityEngagementStats).toHaveBeenCalledWith({
			movieId: 550,
		});
		expect(await res.json()).toEqual({
			watchesCount: 3,
			listsCount: 1,
			favoritesCount: 2,
			watchlistCount: 4,
		});
	});
});
