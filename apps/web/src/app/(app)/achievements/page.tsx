import type { Metadata } from "next";

import { AchievementProgress } from "@/components/gamification/achievement-progress";
import { BadgeShelf } from "@/components/gamification/badge-shelf";
import { Section } from "@/components/ui/section";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Achievements" };
export const dynamic = "force-dynamic";

type EarnedBadge = {
  badge: { id: string; slug: string; name: string; description: string | null; iconUrl: string | null; tier: string };
  userBadge: { awardedAt: string };
};

type AchievementProgressRow = {
  achievement: { id: string; slug: string; name: string; description: string | null; iconUrl: string | null; target: number | null };
  userAchievement: { progress: number; completedAt: string | null } | null;
};

export default async function AchievementsPage() {
  const api = await serverApi();
  const [badgesRes, achRes] = await Promise.all([
    api.api.badges.me.get().catch(() => ({ data: [] })),
    api.api.achievements.me.get().catch(() => ({ data: [] })),
  ]);
  const badges = (badgesRes.data as unknown as EarnedBadge[]) ?? [];
  const achievements = (achRes.data as unknown as AchievementProgressRow[]) ?? [];

  return (
    <div className="space-y-10">
      <Section
        kicker="Lobby wall"
        title="Badges"
        subtitle="Collectibles from the booth — bragging rights, mostly."
      >
        <BadgeShelf badges={badges} />
      </Section>
      <Section
        kicker="Festival circuit"
        title="Achievements"
        subtitle="Long-term goals with progress bars — the slow-burn route."
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {achievements.map((row) => (
            <li key={row.achievement.id}>
              <AchievementProgress
                achievement={row.achievement}
                progress={row.userAchievement?.progress ?? 0}
                completedAt={row.userAchievement?.completedAt ?? null}
              />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
