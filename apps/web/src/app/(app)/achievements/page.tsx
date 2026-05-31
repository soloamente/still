import type { Metadata } from "next";
import { cookies } from "next/headers";
import type {
	BadgeCatalogRow,
	EarnedBadgeRow,
} from "@/components/gamification/achievements-badges-panel";
import type { ChallengeListItem } from "@/components/gamification/achievements-challenges-panel";
import type { AchievementCatalogRow } from "@/components/gamification/achievements-goals-panel";
import { AchievementsLobby } from "@/components/gamification/achievements-lobby";
import { parseAchievementsLobbyTab } from "@/lib/achievements-lobby-tab";
import { serverApi } from "@/lib/server-api";
import { fetchAchievementsChallengesCatalog } from "@/lib/still-api-fetch";

export const metadata: Metadata = { title: "Achievements" };
export const dynamic = "force-dynamic";

type UserAchievementMeRow = {
	userAchievement: {
		achievementId: string;
		progress: number;
		unlockedAt: string | Date | null;
	};
	achievement: AchievementCatalogRow | null;
};

export default async function AchievementsPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) {
	const sp = await searchParams;
	const activeTab = parseAchievementsLobbyTab(sp.tab);

	const cookieStore = await cookies();
	const cookieHeader = cookieStore
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const api = await serverApi();
	const [
		profileRes,
		badgeCatalogRes,
		earnedRes,
		achievementCatalogRes,
		meAchRes,
		challengesFetch,
	] = await Promise.all([
		api.api.profiles.me.get().catch(() => ({ data: null })),
		api.api.badges.catalog.get().catch(() => ({ data: [] })),
		api.api.badges.me.get().catch(() => ({ data: [] })),
		api.api.achievements.catalog.get().catch(() => ({ data: [] })),
		api.api.achievements.me.get().catch(() => ({ data: [] })),
		fetchAchievementsChallengesCatalog({ cookieHeader }),
	]);

	const profile = profileRes.data as {
		handle: string;
		displayName: string;
	} | null;

	const badgeCatalog =
		(badgeCatalogRes.data as unknown as BadgeCatalogRow[]) ?? [];
	const earnedBadges = (earnedRes.data as unknown as EarnedBadgeRow[]) ?? [];
	const achievementCatalog =
		(achievementCatalogRes.data as unknown as AchievementCatalogRow[]) ?? [];

	const meAchievementRows =
		(meAchRes.data as unknown as UserAchievementMeRow[]) ?? [];
	const userAchievements = meAchievementRows
		.filter((row) => row.achievement != null)
		.map((row) => ({
			achievementId: row.userAchievement.achievementId,
			progress: row.userAchievement.progress,
			unlockedAt: row.userAchievement.unlockedAt,
		}));

	const challenges =
		(challengesFetch.data?.challenges as ChallengeListItem[] | undefined) ?? [];
	if (challenges.length === 0 && challengesFetch.error) {
		console.error(
			"[achievements] challenges catalog failed",
			challengesFetch.error.status,
			challengesFetch.error.raw,
		);
	}

	return (
		<AchievementsLobby
			activeTab={activeTab}
			handle={profile?.handle ?? "you"}
			displayName={profile?.displayName ?? "Your"}
			badgeCatalog={badgeCatalog}
			earnedBadges={earnedBadges}
			achievementCatalog={achievementCatalog}
			userAchievements={userAchievements}
			challenges={challenges}
		/>
	);
}
