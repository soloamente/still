/** Achievements lobby sections — URL `?tab=` mirrors profile `?tab=` pattern. */
export type AchievementsLobbyTabId = "badges" | "goals";

const TAB_IDS: AchievementsLobbyTabId[] = ["badges", "goals"];

export function parseAchievementsLobbyTab(
	raw: string | null | undefined,
): AchievementsLobbyTabId {
	if (raw === "goals") return "goals";
	return "badges";
}

export function buildAchievementsLobbyHref(
	tab: AchievementsLobbyTabId,
): string {
	return tab === "badges" ? "/achievements" : `/achievements?tab=${tab}`;
}

export const ACHIEVEMENTS_LOBBY_TAB_LABEL: Record<
	AchievementsLobbyTabId,
	string
> = {
	badges: "Badges",
	goals: "Goals",
};

export function isAchievementsLobbyTabId(
	value: string,
): value is AchievementsLobbyTabId {
	return (TAB_IDS as readonly string[]).includes(value);
}
