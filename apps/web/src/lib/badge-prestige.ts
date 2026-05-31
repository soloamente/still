/**
 * Client mirror of server badge prestige rules (Sense Tier 1).
 */

export const QUANTITY_MILESTONE_BADGE_IDS = new Set([
	"watch_10",
	"watch_100",
	"watch_500",
	"watch_1000",
	"watch_5000",
	"social_10f",
	"social_100f",
	"cur_10l",
]);

const TIER_RANK: Record<string, number> = {
	bronze: 1,
	silver: 2,
	gold: 3,
	platinum: 4,
	legendary: 5,
};

export interface BadgePrestigeInput {
	id: string;
	category: string | null;
	tier: string;
	points: number;
}

export function isProfileShowcaseBadge(badge: BadgePrestigeInput): boolean {
	if (QUANTITY_MILESTONE_BADGE_IDS.has(badge.id)) return false;
	if (badge.category === "watch_milestone" && badge.id !== "watch_1") {
		return false;
	}
	return true;
}

export function badgePrestigeScore(badge: BadgePrestigeInput): number {
	const tier = TIER_RANK[badge.tier] ?? 0;
	return tier * 1000 + badge.points;
}

export function shouldNotifyBadgeAward(badge: BadgePrestigeInput): boolean {
	return isProfileShowcaseBadge(badge);
}

export interface EarnedBadgeRow<TBadge extends BadgePrestigeInput> {
	badge: TBadge;
}

export function pickProfileShowcaseBadges<
	T extends EarnedBadgeRow<BadgePrestigeInput>,
>(rows: T[], limit = 8): T[] {
	return rows
		.filter((row) => isProfileShowcaseBadge(row.badge))
		.sort((a, b) => badgePrestigeScore(b.badge) - badgePrestigeScore(a.badge))
		.slice(0, limit);
}

export function compareBadgeCategoriesForLobby(a: string, b: string): number {
	if (a === b) return 0;
	if (a === "watch_milestone") return 1;
	if (b === "watch_milestone") return -1;
	return a.localeCompare(b);
}

export function isQuantityMilestoneBadge(badgeId: string): boolean {
	return QUANTITY_MILESTONE_BADGE_IDS.has(badgeId);
}
