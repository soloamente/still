/**
 * URL + sort helpers for `/watchlist` lobby — mirrors `diary-lobby-order` so the page can reuse
 * `HomeStickyChrome`, `HomeCatalogViewModeToolbar`, and the same poster grid stack as `/home`.
 */
export type WatchlistLobbyOrder =
	| "latest_added"
	| "earliest_added"
	| "title_az";

const DEFAULT_ORDER: WatchlistLobbyOrder = "latest_added";

/** Row shape from `GET /api/watchlist` — joined `movie` or `tv` for poster + title. */
export type WatchlistLobbyRow = {
	item: {
		addedAt: string;
		movieId: number | null;
		tvId: number | null;
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	tv: { tmdbId: number; title: string; posterPath: string | null } | null;
};

export type WatchlistLobbyRowWithListing =
	| (WatchlistLobbyRow & { movie: NonNullable<WatchlistLobbyRow["movie"]> })
	| (WatchlistLobbyRow & { tv: NonNullable<WatchlistLobbyRow["tv"]> });

/** @deprecated Use `WatchlistLobbyRowWithListing`. */
export type WatchlistLobbyRowWithMovie = WatchlistLobbyRowWithListing;

export function parseWatchlistLobbyOrder(
	raw: string | null | undefined,
): WatchlistLobbyOrder {
	if (
		raw === "latest_added" ||
		raw === "earliest_added" ||
		raw === "title_az"
	) {
		return raw;
	}
	return DEFAULT_ORDER;
}

export function buildWatchlistLobbyHref(opts: {
	order: WatchlistLobbyOrder;
}): string {
	if (opts.order === DEFAULT_ORDER) return "/watchlist";
	const params = new URLSearchParams();
	params.set("order", opts.order);
	return `/watchlist?${params.toString()}`;
}

export function isWatchlistRowWithListing(
	row: WatchlistLobbyRow,
): row is WatchlistLobbyRowWithListing {
	return row.movie != null || row.tv != null;
}

/** @deprecated Use `isWatchlistRowWithListing`. */
export const isWatchlistRowWithMovie = isWatchlistRowWithListing;

function listingTitle(row: WatchlistLobbyRowWithListing): string {
	if (row.movie) return row.movie.title;
	if (row.tv) return row.tv.title;
	return "";
}

function compareWatchlistLobbyRows(
	a: WatchlistLobbyRowWithListing,
	b: WatchlistLobbyRowWithListing,
	order: WatchlistLobbyOrder,
): number {
	switch (order) {
		case "latest_added":
			return (
				new Date(b.item.addedAt).getTime() - new Date(a.item.addedAt).getTime()
			);
		case "earliest_added":
			return (
				new Date(a.item.addedAt).getTime() - new Date(b.item.addedAt).getTime()
			);
		case "title_az": {
			const t = listingTitle(a).localeCompare(listingTitle(b), undefined, {
				sensitivity: "base",
			});
			if (t !== 0) return t;
			return (
				new Date(b.item.addedAt).getTime() - new Date(a.item.addedAt).getTime()
			);
		}
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}

/** Stable sort for the watchlist lobby — mutates a copy only. */
export function sortWatchlistLobbyRowsForOrder(
	rows: WatchlistLobbyRowWithListing[],
	order: WatchlistLobbyOrder,
): WatchlistLobbyRowWithListing[] {
	return rows.slice().sort((a, b) => compareWatchlistLobbyRows(a, b, order));
}
