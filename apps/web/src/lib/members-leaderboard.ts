import type { MembersLeaderboardSort } from "@/lib/members-leaderboard-types";

/** Left-rail sort chips on Community **Members** — diary volume is the default dimension. */
export const MEMBERS_LEADERBOARD_SORTS = [
	{ id: "popular", label: "Popular", title: "Most diary logs in this period" },
	{ id: "reviews", label: "Reviews", title: "Most published reviews" },
	{ id: "lists", label: "Lists", title: "Most public lists created" },
	{ id: "likes", label: "Likes", title: "Most review likes received" },
] as const satisfies readonly {
	id: MembersLeaderboardSort;
	label: string;
	title: string;
}[];

export const DEFAULT_MEMBERS_LEADERBOARD_SORT: MembersLeaderboardSort =
	"popular";

/** Parse legacy `?memberSort=` or `/members?sort=` — defaults to **popular**. */
export function parseMembersLeaderboardSort(
	raw: string | undefined | null,
): MembersLeaderboardSort {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "reviews" || s === "lists" || s === "likes" || s === "popular") {
		return s;
	}
	return DEFAULT_MEMBERS_LEADERBOARD_SORT;
}

export function membersLeaderboardSortLabel(
	sort: MembersLeaderboardSort,
): string {
	return (
		MEMBERS_LEADERBOARD_SORTS.find((chip) => chip.id === sort)?.label ??
		"Popular"
	);
}

/** Short noun beside the rank count — matches the active sort dimension. */
export function membersLeaderboardStatNoun(
	sort: MembersLeaderboardSort,
	count: number,
): string {
	const plural = count === 1 ? "" : "s";
	switch (sort) {
		case "popular":
			return `log${plural}`;
		case "reviews":
			return `review${plural}`;
		case "lists":
			return `list${plural}`;
		case "likes":
			return `like${plural}`;
		default: {
			const _exhaustive: never = sort;
			return _exhaustive;
		}
	}
}

/** Omit from URL when still the default (**popular**). */
export function serializeMembersLeaderboardSort(
	sort: MembersLeaderboardSort,
): string | undefined {
	return sort === DEFAULT_MEMBERS_LEADERBOARD_SORT ? undefined : sort;
}
