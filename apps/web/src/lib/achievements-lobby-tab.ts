/** Achievements lobby sections — URL `?tab=` mirrors profile `?tab=` pattern. */
export type AchievementsLobbyTabId = "badges" | "goals" | "challenges";

const TAB_IDS: AchievementsLobbyTabId[] = ["badges", "goals", "challenges"];

export function parseAchievementsLobbyTab(
	raw: string | null | undefined,
): AchievementsLobbyTabId {
	if (raw === "goals") return "goals";
	if (raw === "challenges") return "challenges";
	return "badges";
}

export function buildAchievementsLobbyHref(
	tab: AchievementsLobbyTabId,
): string {
	if (tab === "badges") return "/achievements";
	return `/achievements?tab=${tab}`;
}

export const ACHIEVEMENTS_LOBBY_TAB_LABEL: Record<
	AchievementsLobbyTabId,
	string
> = {
	badges: "Badges",
	goals: "Goals",
	challenges: "Challenges",
};

export function isAchievementsLobbyTabId(
	value: string,
): value is AchievementsLobbyTabId {
	return (TAB_IDS as readonly string[]).includes(value);
}
