import type { MembersLeaderboardLedgerItem } from "@/lib/members-leaderboard-item-types";
import type { MembersLeaderboardSort } from "@/lib/members-leaderboard-types";

/** Contribution ledger sorts by recency only — no title ordering. */
export type PatronMembersLedgerOrder = "latest" | "earliest";

export const DEFAULT_PATRON_MEMBERS_LEDGER_ORDER: PatronMembersLedgerOrder =
	"latest";

function compareSortAt(
	a: MembersLeaderboardLedgerItem,
	b: MembersLeaderboardLedgerItem,
) {
	const at = new Date(a.sortAt).getTime();
	const bt = new Date(b.sortAt).getTime();
	if (at !== bt) return bt - at;
	return a.itemKey.localeCompare(b.itemKey);
}

/** Chip labels for the members ledger order rail — keyed by rank dimension. */
export function patronMembersLedgerOrderLabels(sort: MembersLeaderboardSort): {
	latest: string;
	earliest: string;
	latestTitle: string;
	earliestTitle: string;
	latestAriaLabel: string;
	earliestAriaLabel: string;
	toolbarDescription: string;
} {
	switch (sort) {
		case "reviews":
		case "likes":
			return {
				latest: "Latest reviewed",
				earliest: "Earliest reviewed",
				latestTitle: "Newest reviews first — when they published each review",
				earliestTitle:
					"Oldest reviews first — chronological from their first review",
				latestAriaLabel: "Latest reviewed — order by most recent publish date",
				earliestAriaLabel:
					"Earliest reviewed — order by oldest publish date first",
				toolbarDescription:
					"Choose how this patron's reviews are ordered — by publish date.",
			};
		case "lists":
			return {
				latest: "Latest",
				earliest: "Earliest",
				latestTitle: "Newest lists first — when each list was last updated",
				earliestTitle:
					"Oldest lists first — chronological from their first list",
				latestAriaLabel: "Latest — order by most recent list activity",
				earliestAriaLabel: "Earliest — order by oldest list activity first",
				toolbarDescription:
					"Choose how this patron's lists are ordered — by activity date.",
			};
		case "popular":
			return {
				latest: "Latest seen",
				earliest: "Earliest seen",
				latestTitle: "Newest diary logs first — when they watched each title",
				earliestTitle:
					"Oldest diary logs first — chronological from their first log",
				latestAriaLabel: "Latest seen — order by most recent watch date",
				earliestAriaLabel: "Earliest seen — order by oldest watch date first",
				toolbarDescription:
					"Choose how this patron's diary log is ordered — by watch date.",
			};
		default: {
			const _exhaustive: never = sort;
			return _exhaustive;
		}
	}
}

/** Client-side sort for the patron members ledger drawer. */
export function sortPatronMembersLedgerItems(
	items: MembersLeaderboardLedgerItem[],
	order: PatronMembersLedgerOrder,
): MembersLeaderboardLedgerItem[] {
	const copy = items.slice();
	copy.sort((a, b) => {
		switch (order) {
			case "latest":
				return compareSortAt(a, b);
			case "earliest":
				return -compareSortAt(a, b);
			default: {
				const _exhaustive: never = order;
				return _exhaustive;
			}
		}
	});
	return copy;
}
