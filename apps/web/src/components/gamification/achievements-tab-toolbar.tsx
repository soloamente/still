"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import {
	ACHIEVEMENTS_LOBBY_TAB_LABEL,
	type AchievementsLobbyTabId,
	buildAchievementsLobbyHref,
} from "@/lib/achievements-lobby-tab";

/**
 * Badges / Goals chips — same pill rail as `ProfileTabToolbar` on `bg-background`.
 */
export function AchievementsTabToolbar({
	activeTab,
}: {
	activeTab: AchievementsLobbyTabId;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const tabs: AchievementsLobbyTabId[] = ["badges", "goals"];

	const chipLink = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			"px-3 py-2 sm:px-3.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	return (
		<nav
			className="flex min-w-0 max-w-full flex-wrap justify-center gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
			role="toolbar"
			aria-label="Achievements sections"
		>
			{tabs.map((tab) => {
				const active = tab === activeTab;
				return (
					<Link
						key={tab}
						href={buildAchievementsLobbyHref(tab)}
						scroll={false}
						aria-current={active ? "page" : undefined}
						className={chipLink(active)}
					>
						{active ? (
							<motion.span
								layoutId="achievements-lobby-tab-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10 whitespace-nowrap">
							{ACHIEVEMENTS_LOBBY_TAB_LABEL[tab]}
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
