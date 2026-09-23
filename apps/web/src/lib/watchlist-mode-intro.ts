import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

/** Visible one-liner under the sort chips — explains what the active sort is doing. */
export function watchlistModeIntroCopy(
	order: WatchlistLobbyOrder,
	opts: { totalResults?: number } = {},
): string {
	const count =
		typeof opts.totalResults === "number" && opts.totalResults > 0
			? `${opts.totalResults} ${opts.totalResults === 1 ? "save" : "saves"} · `
			: "";

	switch (order) {
		case "latest_added":
			return `${count}Newest clips first — title on each poster`;
		case "earliest_added":
			return `${count}Oldest clips first — title on each poster`;
		case "title_az":
			return `${count}Alphabetical by title`;
		default: {
			const unreachable: never = order;
			return unreachable;
		}
	}
}
