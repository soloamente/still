import type { DiaryLobbyOrder } from "@/lib/diary-lobby-order";
import type { LeaderboardLogItem } from "@/lib/home-leaderboard-types";

export type PatronWatchLedgerOrder = DiaryLobbyOrder;

function compareLogRecency(
	a: LeaderboardLogItem,
	b: LeaderboardLogItem,
): number {
	const at = new Date(a.watchedAt).getTime();
	const bt = new Date(b.watchedAt).getTime();
	if (at !== bt) return bt - at;
	return b.logId.localeCompare(a.logId);
}

function compareLeaderboardLogItems(
	a: LeaderboardLogItem,
	b: LeaderboardLogItem,
	order: PatronWatchLedgerOrder,
): number {
	switch (order) {
		case "latest_seen":
			return compareLogRecency(a, b);
		case "earliest_seen":
			return -compareLogRecency(a, b);
		case "title_az": {
			const t = a.title.localeCompare(b.title, undefined, {
				sensitivity: "base",
			});
			if (t !== 0) return t;
			return compareLogRecency(a, b);
		}
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}

/** Client-side sort for the patron watch ledger drawer (same orders as `/diary`). */
export function sortPatronWatchLedgerItems(
	items: LeaderboardLogItem[],
	order: PatronWatchLedgerOrder,
): LeaderboardLogItem[] {
	return items.slice().sort((a, b) => compareLeaderboardLogItems(a, b, order));
}
