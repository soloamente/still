"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { shouldNotifyBadgeAward } from "@/lib/badge-prestige";
import { fetchBadgesRecent } from "@/lib/still-api-fetch";

/**
 * Polls /badges/me/recent every minute and fires a toast whenever the
 * server hands us a newly-awarded badge. Cheap (single small query)
 * and gives the user the same "you got something!" feedback Letterboxd
 * lacks. Mount once in the (app)/layout.
 */
export function BadgeWatcher() {
	const { play } = useCinematicAudio();

	useEffect(() => {
		let cancelled = false;
		let since = new Date().toISOString();

		async function poll() {
			try {
				const res = await fetchBadgesRecent(since);
				if (cancelled || res.error || !Array.isArray(res.data)) return;
				const rows = res.data as {
					badge: {
						id: string;
						name: string;
						description: string | null;
						category: string | null;
						tier: string;
						points: number;
					} | null;
					userBadge: { awardedAt: string };
				}[];
				for (const row of rows) {
					if (!row.badge) continue;
					if (
						!shouldNotifyBadgeAward({
							id: row.badge.id,
							category: row.badge.category,
							tier: row.badge.tier,
							points: row.badge.points,
						})
					) {
						since = row.userBadge.awardedAt;
						continue;
					}
					toast.success(`Badge unlocked: ${row.badge.name}`, {
						description: row.badge.description ?? undefined,
						duration: 6000,
					});
					void play("curtain-rise", { category: "feedback" }).catch(
						() => undefined,
					);
					since = row.userBadge.awardedAt;
				}
			} catch {
				// Silent — we'll just retry next tick.
			}
		}

		const interval = setInterval(poll, 60_000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [play]);

	return null;
}
