/**
 * Editorial cold-start slots (Sense Tier 0) — surfaced when the social graph is thin.
 * Curate weekly until organic Community density is enough.
 */

export interface EditorialHighlight {
	id: string;
	title: string;
	description: string;
	href: string;
	kind: "list" | "community" | "discover";
}

export const EDITORIAL_COMMUNITY_HIGHLIGHTS: EditorialHighlight[] = [
	{
		id: "community-lists",
		title: "Lists shaping the lobby",
		description:
			"Browse public lists from patrons — save titles and follow curators as you build your graph.",
		href: "/home?browse=community&sort=lists",
		kind: "community",
	},
	{
		id: "community-reviews",
		title: "Recent reviews",
		description:
			"Long-form takes and quick scores — disagreement is welcome; consensus is boring.",
		href: "/home?browse=community&sort=reviews",
		kind: "community",
	},
	{
		id: "discover-movies",
		title: "Discover on Movies",
		description:
			"Latest and popular films with venue filters — log what you watch tonight.",
		href: "/home?browse=movies&sort=latest",
		kind: "discover",
	},
];
