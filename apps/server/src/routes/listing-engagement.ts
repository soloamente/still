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

const engagementListRouteSchema = {
	params: t.Object({ id: t.String() }),
	query: t.Object({
		page: t.Optional(t.String()),
		limit: t.Optional(t.String()),
	}),
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

/** Handler factory for paginated engagement drawer lists (watches, lists, etc.). */
function createEngagementListHandler(
	listingKind: "movie" | "tv",
	kind: ListingEngagementKind,
) {
	return async ({
		params,
		query,
		user,
		status,
	}: {
		params: { id: string };
		query: { page?: string; limit?: string };
		user: { id: string } | null;
		status: (code: number, message: string) => unknown;
	}) => {
		if (!user) return status(401, "Unauthorized");

		const listing = parseListingId(listingKind, params.id);
		if (!listing) return status(400, "Invalid id");

		return engagementQuery[kind]({
			listing,
			viewerId: user.id,
			page: query.page,
			limit: query.limit,
		});
	};
}

/** Shared engagement drawer routes for movie and TV detail. */
export function createListingEngagementRoutes(listingKind: "movie" | "tv") {
	// Chain `.get()` fluently — reassigning `plugin` breaks Eden/App inference when
	// the web app type-checks this module via `@still/api-client` → `server/app`.
	return new Elysia({ name: `listing-engagement-${listingKind}` })
		.use(context)
		.get(
			"/:id/engagement/summary",
			async ({ params, user, status }) => {
				if (!user) return status(401, "Unauthorized");

				const listing = parseListingId(listingKind, params.id);
				if (!listing) return status(400, "Invalid id");

				return fetchListingCommunityEngagementStats(listing);
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.get(
			`/:id/engagement/${ENGAGEMENT_KINDS[0]}`,
			createEngagementListHandler(listingKind, ENGAGEMENT_KINDS[0]),
			engagementListRouteSchema,
		)
		.get(
			`/:id/engagement/${ENGAGEMENT_KINDS[1]}`,
			createEngagementListHandler(listingKind, ENGAGEMENT_KINDS[1]),
			engagementListRouteSchema,
		)
		.get(
			`/:id/engagement/${ENGAGEMENT_KINDS[2]}`,
			createEngagementListHandler(listingKind, ENGAGEMENT_KINDS[2]),
			engagementListRouteSchema,
		)
		.get(
			`/:id/engagement/${ENGAGEMENT_KINDS[3]}`,
			createEngagementListHandler(listingKind, ENGAGEMENT_KINDS[3]),
			engagementListRouteSchema,
		);
}

/** Mount on existing movie/TV route trees (each plugin carries its own context). */
export const movieListingEngagementRoutes =
	createListingEngagementRoutes("movie");
export const tvListingEngagementRoutes = createListingEngagementRoutes("tv");
