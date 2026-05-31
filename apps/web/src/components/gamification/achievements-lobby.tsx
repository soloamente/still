"use client";

import { cn } from "@still/ui/lib/utils";
import { Suspense } from "react";

import { LobbyCenterTabFallback } from "@/components/app/lobby-suspense-fallbacks";
import {
	AchievementsBadgesPanel,
	type BadgeCatalogRow,
	type EarnedBadgeRow,
} from "@/components/gamification/achievements-badges-panel";
import {
	AchievementsChallengesPanel,
	type ChallengeListItem,
} from "@/components/gamification/achievements-challenges-panel";
import { AchievementsCreatorAnalyticsCard } from "@/components/gamification/achievements-creator-analytics-card";
import {
	type AchievementCatalogRow,
	type AchievementLobbyRow,
	AchievementsGoalsPanel,
	type UserAchievementRow,
} from "@/components/gamification/achievements-goals-panel";
import { AchievementsTabToolbar } from "@/components/gamification/achievements-tab-toolbar";
import { AchievementsTopBar } from "@/components/gamification/achievements-top-bar";
import { AchievementsWatchStreakCard } from "@/components/gamification/achievements-watch-streak-card";
import type { AchievementsLobbyTabId } from "@/lib/achievements-lobby-tab";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

export type AchievementsLobbyProps = {
	activeTab: AchievementsLobbyTabId;
	handle: string;
	displayName: string;
	badgeCatalog: BadgeCatalogRow[];
	earnedBadges: EarnedBadgeRow[];
	achievementCatalog: AchievementCatalogRow[];
	userAchievements: {
		achievementId: string;
		progress: number;
		unlockedAt: string | Date | null;
	}[];
	challenges: ChallengeListItem[];
};

function mergeAchievementRows(
	catalog: AchievementCatalogRow[],
	userRows: AchievementsLobbyProps["userAchievements"],
): AchievementLobbyRow[] {
	const byAchievementId = new Map(
		userRows.map((ua) => [ua.achievementId, ua] as const),
	);

	return catalog.map((achievement) => {
		const ua = byAchievementId.get(achievement.id);
		const userAchievement: UserAchievementRow | null = ua
			? { progress: ua.progress, unlockedAt: ua.unlockedAt }
			: null;
		return { achievement, userAchievement };
	});
}

/**
 * Achievements lobby ÔÇö profile/diary shell (`bg-card` tray, sticky top bar, tab chips).
 */
export function AchievementsLobby({
	activeTab,
	handle,
	displayName,
	badgeCatalog,
	earnedBadges,
	achievementCatalog,
	userAchievements,
	challenges,
}: AchievementsLobbyProps) {
	const goalRows = mergeAchievementRows(achievementCatalog, userAchievements);

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<AchievementsTopBar />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"min-h-0 flex-1 gap-5 overflow-visible p-6 sm:gap-6 sm:p-8",
				)}
			>
				<header className="space-y-2 text-center">
					<p className="font-medium text-foreground/80 text-xs tracking-wide">
						@{handle}
					</p>
					<p className="mx-auto max-w-prose text-balance font-medium font-sans text-foreground text-lg tracking-tight sm:text-xl">
						{displayName}&apos;s collection
					</p>
					<p className="mx-auto max-w-xs text-balance text-muted-foreground text-sm leading-relaxed">
						Badges mark moments on the circuit. <br /> Goals track the slow-burn
						routes ÔÇö log, review, and show up for your circle.
					</p>
				</header>

				<div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-3">
					<AchievementsWatchStreakCard />
					<AchievementsCreatorAnalyticsCard />
				</div>

				<div className="flex justify-center">
					<Suspense fallback={<LobbyCenterTabFallback />}>
						<AchievementsTabToolbar activeTab={activeTab} />
					</Suspense>
				</div>

				<div className="min-h-0 flex-1">
					{activeTab === "badges" ? (
						<AchievementsBadgesPanel
							catalog={badgeCatalog}
							earned={earnedBadges}
						/>
					) : activeTab === "challenges" ? (
						<AchievementsChallengesPanel initialChallenges={challenges} />
					) : (
						<AchievementsGoalsPanel rows={goalRows} />
					)}
				</div>
			</section>
		</div>
	);
}
