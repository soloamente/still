"use client";

import { useRouter } from "next/navigation";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	ACHIEVEMENTS_LOBBY_TAB_LABEL,
	type AchievementsLobbyTabId,
	buildAchievementsLobbyHref,
} from "@/lib/achievements-lobby-tab";

/**
 * Badges / Goals / Challenges — liquid-gooey Move pill (lobby chip parity).
 */
export function AchievementsTabToolbar({
	activeTab,
}: {
	activeTab: AchievementsLobbyTabId;
}) {
	const router = useRouter();
	const tabs: AchievementsLobbyTabId[] = ["badges", "goals", "challenges"];

	return (
		<SegmentedPillToolbar
			layoutId="achievements-lobby-tab-pill"
			aria-label="Achievements sections"
			value={activeTab}
			onChange={(tab) => {
				router.push(buildAchievementsLobbyHref(tab), { scroll: false });
			}}
			options={tabs.map((tab) => ({
				id: tab,
				label: ACHIEVEMENTS_LOBBY_TAB_LABEL[tab],
			}))}
			compact
			className="max-w-full flex-wrap justify-center sm:flex-nowrap"
		/>
	);
}
