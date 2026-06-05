"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { Flame } from "lucide-react";
import Image from "next/image";

import {
	ACHIEVEMENT_HEPTAGON_CLASS,
	HEPTAGON_CLIP,
	MilestoneBadgeGlyph,
} from "@/components/gamification/milestone-badge-glyph";
import { formatDate } from "@/lib/format";

/** Earned badge row from `GET /api/badges/of/:userId`. */
export type ProfileEarnedBadge = {
	badge: {
		id: string;
		slug: string;
		name: string;
		description: string | null;
		iconUrl: string | null;
		tier: string;
		category: string | null;
		points: number;
	};
	userBadge: { awardedAt: string | Date };
};

/** Unlocked achievement row from `GET /api/achievements/of/:userId`. */
export type ProfileUnlockedAchievement = {
	achievement: {
		id: string;
		slug: string;
		name: string;
		description: string | null;
		iconUrl: string | null;
		target: number | null;
	};
	userAchievement: { unlockedAt: string | Date | null; progress: number };
};

/** Parse award time from API (ISO string or `Date`) for display. */
function parseAwardDate(value: string | Date): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar line for tooltips, e.g. "Awarded on May 20, 2026". */
function formatOnDateLine(
	prefix: string,
	value: string | Date | null | undefined,
): string | null {
	if (value == null) return null;
	const d = parseAwardDate(value);
	if (!d) return `${prefix} — date unavailable`;
	return `${prefix} ${formatDate(d)}`;
}

const HEPTAGON_GLYPH_CLASS =
	"grid size-17 shrink-0 place-items-center overflow-visible";

type ProfilePatronMilestonesProps = {
	handle: string;
	earnedBadges: ProfileEarnedBadge[];
	unlockedAchievements: ProfileUnlockedAchievement[];
	/** Curator reach line for list badges — e.g. `12 public lists · 48 list likes`. */
	curatorHeadline?: string | null;
};

/**
 * Centered badge / achievement tray under the patron header — no card chrome.
 * Short names sit under each tile; full detail + awarded date on hover (shared tooltip pattern).
 */
export function ProfilePatronMilestones({
	handle,
	earnedBadges,
	unlockedAchievements,
	curatorHeadline = null,
}: ProfilePatronMilestonesProps) {
	if (earnedBadges.length === 0 && unlockedAchievements.length === 0) {
		return null;
	}

	return (
		<div className="mb-6 flex justify-center overflow-visible px-1 pt-1">
			<TooltipProvider delay={280} closeDelay={80}>
				<ul
					className="flex max-w-full flex-wrap justify-center gap-x-7 gap-y-5 overflow-visible px-1"
					aria-label={`Badges and achievements for @${handle}`}
				>
					{earnedBadges.map(({ badge, userBadge }) => {
						const body = badge.description?.trim();
						const curatorReach =
							badge.category === "curator" && curatorHeadline?.trim()
								? curatorHeadline.trim()
								: null;
						return (
							<li
								key={`b:${badge.id}`}
								className="flex w-22 shrink-0 flex-col items-center gap-1 overflow-visible text-center"
							>
								<Tooltip>
									<TooltipTrigger
										render={
											<button
												type="button"
												className={cn(
													"group overflow-visible rounded-none p-1 focus-visible:outline-none",
													"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
													"motion-reduce:transition-none [@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-200 [@media(hover:hover)]:ease-out",
													"[@media(hover:hover)]:group-hover:scale-[1.04]",
												)}
												aria-label={`${badge.name} — open details`}
											>
												<MilestoneBadgeGlyph
													iconUrl={badge.iconUrl}
													tier={badge.tier}
													name={badge.name}
												/>
											</button>
										}
									/>
									<TooltipContent className="max-w-76 px-2.5 py-1.5 text-center">
										<div className="flex flex-col items-center gap-0.5 text-center">
											<span className="font-medium leading-tight">
												{badge.name}
											</span>
											{body ? (
												<span className="text-[11px] text-background/85 leading-tight">
													{body}
												</span>
											) : null}
											{curatorReach ? (
												<span className="text-[11px] text-background/85 tabular-nums leading-tight">
													{curatorReach}
												</span>
											) : null}
											<span className="text-[10px] text-background/70 tabular-nums leading-tight">
												{formatOnDateLine("Awarded on", userBadge.awardedAt)}
											</span>
										</div>
									</TooltipContent>
								</Tooltip>
								<span className="text-balance text-[11px] text-muted-foreground leading-snug">
									{badge.name}
								</span>
							</li>
						);
					})}
					{unlockedAchievements.map(({ achievement: ach, userAchievement }) => {
						const body = ach.description?.trim();
						const unlockedLine = formatOnDateLine(
							"Unlocked on",
							userAchievement.unlockedAt,
						);
						return (
							<li
								key={`a:${ach.id}`}
								className="flex w-22 shrink-0 flex-col items-center gap-1 overflow-visible text-center"
							>
								<Tooltip>
									<TooltipTrigger
										render={
											<button
												type="button"
												className={cn(
													"group overflow-visible rounded-none p-1 focus-visible:outline-none",
													"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
													"motion-reduce:transition-none [@media(hover:hover)]:transition-transform [@media(hover:hover)]:duration-200 [@media(hover:hover)]:ease-out",
													"[@media(hover:hover)]:group-hover:scale-[1.04]",
												)}
												aria-label={`${ach.name} — open details`}
											>
												<div
													className={cn(
														HEPTAGON_GLYPH_CLASS,
														HEPTAGON_CLIP,
														ACHIEVEMENT_HEPTAGON_CLASS,
													)}
												>
													{ach.iconUrl ? (
														<Image
															src={ach.iconUrl}
															alt=""
															width={28}
															height={28}
															unoptimized
															className="size-7 object-contain opacity-95"
														/>
													) : (
														<Flame
															className="size-7 opacity-95"
															strokeWidth={1.5}
															aria-hidden
														/>
													)}
												</div>
											</button>
										}
									/>
									<TooltipContent className="max-w-76 px-2.5 py-1.5 text-center">
										<div className="flex flex-col items-center gap-0.5 text-center">
											<span className="font-medium leading-tight">
												{ach.name}
											</span>
											{body ? (
												<span className="text-[11px] text-background/85 leading-tight">
													{body}
												</span>
											) : null}
											{unlockedLine ? (
												<span className="text-[10px] text-background/70 tabular-nums leading-tight">
													{unlockedLine}
												</span>
											) : null}
										</div>
									</TooltipContent>
								</Tooltip>
								<span className="text-balance text-[11px] text-muted-foreground leading-snug">
									{ach.name}
								</span>
							</li>
						);
					})}
				</ul>
			</TooltipProvider>
		</div>
	);
}
