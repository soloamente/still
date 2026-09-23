import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

/** Visible one-liner under the mode chips — explains what the active sort is doing. */
export function watchlistModeIntroCopy(
	order: WatchlistLobbyOrder,
	opts: { totalResults?: number } = {},
): string {
	const count =
		typeof opts.totalResults === "number" && opts.totalResults > 0
			? `${opts.totalResults} ${opts.totalResults === 1 ? "save" : "saves"} · `
			: "";

	switch (order) {
		case "tonight":
			return `${count}Ranked for tonight — one reason on each poster`;
		case "available":
			return `${count}Streaming on a subscription in your region`;
		case "continue":
			return `${count}Shows you're in the middle of — next episode on each tile`;
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
