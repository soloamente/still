import { Elysia, t } from "elysia";

import { context } from "../context";
import { fetchListingCommunityEngagementStats } from "../lib/listing-community-stats";
import {
	fetchListingEngagementFavorites,
	fetchListingEngagementLists,
	fetchListingEngagementWatches,
	fetchListingEngagementWatchlist,
	type ListingEngagementKind,
} from "../lib/listing-engagement-query";

const ENGAGEMENT_KINDS = [
	"watches",
	"lists",
	"favorites",
	"watchlist",
] as const satisfies readonly ListingEngagementKind[];

const engagementQuery = {
	watches: fetchListingEngagementWatches,
	lists: fetchListingEngagementLists,
	favorites: fetchListingEngagementFavorites,
	watchlist: fetchListingEngagementWatchlist,
};

function parseListingId(
	kind: "movie" | "tv",
	raw: string,
): { movieId: number } | { tvId: number } | null {
	const id = Number(raw);
	if (!Number.isFinite(id) || id < 1) return null;
	return kind === "movie"
		? { movieId: Math.floor(id) }
		: { tvId: Math.floor(id) };
}

/** Shared engagement drawer routes for movie and TV detail. */
export function createListingEngagementRoutes(listingKind: "movie" | "tv") {
	let plugin = new Elysia({ name: `listing-engagement-${listingKind}` }).use(
		context,
	);

	plugin = plugin.get(
		"/:id/engagement/summary",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Unauthorized");

			const listing = parseListingId(listingKind, params.id);
			if (!listing) return status(400, "Invalid id");

			return fetchListingCommunityEngagementStats(listing);
		},
		{ params: t.Object({ id: t.String() }) },
	);

	for (const kind of ENGAGEMENT_KINDS) {
		plugin = plugin.get(
			`/:id/engagement/${kind}`,
			async ({ params, query, user, status }) => {
				if (!user) return status(401, "Unauthorized");

				const listing = parseListingId(listingKind, params.id);
				if (!listing) return status(400, "Invalid id");

				return engagementQuery[kind]({
					listing,
					viewerId: user.id,
					page: query.page,
					limit: query.limit,
				});
			},
			{
				params: t.Object({ id: t.String() }),
				query: t.Object({
					page: t.Optional(t.String()),
					limit: t.Optional(t.String()),
				}),
			},
		);
	}

	return plugin;
}

/** Mount on existing movie/TV route trees (each plugin carries its own context). */
export const movieListingEngagementRoutes =
	createListingEngagementRoutes("movie");
export const tvListingEngagementRoutes = createListingEngagementRoutes("tv");
