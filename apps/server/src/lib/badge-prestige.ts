/**
 * Sense Tier 1 — badge scarcity: volume milestones stay in Achievements,
 * prestige badges drive profile identity and notifications.
 */

/** Pure volume ladders — earned in Achievements, not profile showcase. */
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

/** Whether this badge should appear on the public profile milestone tray. */
export function isProfileShowcaseBadge(badge: BadgePrestigeInput): boolean {
	if (QUANTITY_MILESTONE_BADGE_IDS.has(badge.id)) return false;
	if (badge.category === "watch_milestone" && badge.id !== "watch_1") {
		return false;
	}
	return true;
}

/** Higher = more prestigious when picking profile slots. */
export function badgePrestigeScore(badge: BadgePrestigeInput): number {
	const tier = TIER_RANK[badge.tier] ?? 0;
	return tier * 1000 + badge.points;
}

/** Toast + inbox for unlocks — skip noisy volume milestones. */
export function shouldNotifyBadgeAward(badge: BadgePrestigeInput): boolean {
	if (!isProfileShowcaseBadge(badge)) return false;
	return true;
}

export interface EarnedBadgeRow<TBadge extends BadgePrestigeInput> {
	badge: TBadge;
}

/** Profile tray: showcase-only, highest prestige first, capped. */
export function pickProfileShowcaseBadges<
	T extends EarnedBadgeRow<BadgePrestigeInput>,
>(rows: T[], limit = 8): T[] {
	return rows
		.filter((row) => isProfileShowcaseBadge(row.badge))
		.sort((a, b) => badgePrestigeScore(b.badge) - badgePrestigeScore(a.badge))
		.slice(0, limit);
}

/** Achievements lobby: prestige categories before volume milestones. */
export function compareBadgeCategoriesForLobby(a: string, b: string): number {
	if (a === b) return 0;
	if (a === "watch_milestone") return 1;
	if (b === "watch_milestone") return -1;
	return a.localeCompare(b);
}
