import type { LeaderboardKind } from "@/lib/home-leaderboard-types";

/** Patron-facing count noun on rank rows and podium (e.g. "3 episodes"). */
export function leaderboardKindCountLabel(
	kind: LeaderboardKind,
	count: number,
): string {
	switch (kind) {
		case "films":
			return count === 1 ? "film" : "films";
		case "tv":
			return count === 1 ? "show" : "shows";
		case "episodes":
			return count === 1 ? "episode" : "episodes";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Visible pedestal / row CTA for the watch-ledger drawer. */
export function leaderboardKindLedgerCta(kind: LeaderboardKind): string {
	switch (kind) {
		case "films":
			return "View films";
		case "tv":
			return "View logs";
		case "episodes":
			return "View episodes";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Empty ledger grid copy when a patron has no qualifying logs in the window. */
export function leaderboardKindEmptyLedgerLabel(kind: LeaderboardKind): string {
	switch (kind) {
		case "films":
			return "film";
		case "tv":
			return "show";
		case "episodes":
			return "episode";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}
