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
import type { ReactNode } from "react";

import {
	ACHIEVEMENT_HEPTAGON_CLASS,
	HEPTAGON_CLIP,
} from "@/components/gamification/milestone-badge-glyph";
import { formatDate } from "@/lib/format";

export type AchievementCatalogRow = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	iconUrl: string | null;
	target: number | null;
	points: number;
	isHidden: boolean;
};

export type UserAchievementRow = {
	progress: number;
	unlockedAt: string | Date | null;
};

export type AchievementLobbyRow = {
	achievement: AchievementCatalogRow;
	userAchievement: UserAchievementRow | null;
};

const HEPTAGON_GLYPH_CLASS =
	"grid size-17 shrink-0 place-items-center overflow-visible";

/** Ring frame — matches badge artwork tile footprint on the profile tray. */
const GOAL_RING_FRAME_CLASS =
	"relative flex h-[4.75rem] w-[4.25rem] shrink-0 items-center justify-center overflow-visible";

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function parseTimestamp(value: string | Date | null | undefined): Date | null {
	if (value == null) return null;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function formatUnlockedLine(
	value: string | Date | null | undefined,
): string | null {
	if (value == null) return null;
	const d = parseTimestamp(value);
	if (!d) return "Unlocked — date unavailable";
	return `Unlocked ${formatDate(d)}`;
}

function shouldShowGoal(row: AchievementLobbyRow): boolean {
	const { achievement: a, userAchievement: ua } = row;
	if (!a.isHidden) return true;
	if (ua?.unlockedAt) return true;
	if (ua && ua.progress > 0) return true;
	return false;
}

function AchievementGlyph({
	achievement,
	complete,
}: {
	achievement: AchievementCatalogRow;
	complete: boolean;
}) {
	return (
		<div
			className={cn(
				HEPTAGON_GLYPH_CLASS,
				HEPTAGON_CLIP,
				ACHIEVEMENT_HEPTAGON_CLASS,
				!complete && "opacity-90",
			)}
		>
			{achievement.iconUrl ? (
				<Image
					src={achievement.iconUrl}
					alt=""
					width={28}
					height={28}
					unoptimized
					className="size-7 object-contain opacity-95"
				/>
			) : (
				<Flame className="size-7 opacity-95" strokeWidth={1.5} aria-hidden />
			)}
		</div>
	);
}

/** SVG ring on `bg-card` — progress arc uses desert-orange like detail accents. */
function GoalProgressRing({
	pct,
	complete,
	children,
}: {
	pct: number;
	complete: boolean;
	children: ReactNode;
}) {
	const clamped = Math.min(100, Math.max(0, pct));
	const dashOffset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE;

	return (
		<div className={GOAL_RING_FRAME_CLASS}>
			<svg
				className="pointer-events-none absolute inset-0 size-full -rotate-90"
				viewBox="0 0 76 76"
				role="img"
				aria-label={`${clamped}% progress`}
			>
				<title>{`${clamped}% progress`}</title>
				<circle
					cx="38"
					cy="38"
					r={RING_RADIUS}
					fill="none"
					className="stroke-background"
					strokeWidth="3"
				/>
				<circle
					cx="38"
					cy="38"
					r={RING_RADIUS}
					fill="none"
					className={cn(
						"stroke-desert-orange/75 transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none",
						complete && "stroke-desert-orange",
					)}
					strokeWidth="3"
					strokeLinecap="round"
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={complete ? 0 : dashOffset}
				/>
			</svg>
			<div className="relative">{children}</div>
		</div>
	);
}

function GoalTile({ row }: { row: AchievementLobbyRow }) {
	const { achievement, userAchievement } = row;
	const goal = achievement.target ?? 1;
	const progress = userAchievement?.progress ?? 0;
	const unlockedAt = userAchievement?.unlockedAt ?? null;
	const complete = Boolean(unlockedAt);
	const pct = Math.min(100, Math.round((progress / Math.max(1, goal)) * 100));
	const isSecret = achievement.isHidden && !complete && progress > 0;
	const displayName = isSecret ? "Secret goal" : achievement.name;
	const body = achievement.description?.trim();
	const unlockedLine = formatUnlockedLine(unlockedAt);

	return (
		<li className="flex w-24 shrink-0 flex-col items-center gap-1.5 overflow-visible text-center">
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
							aria-label={`${displayName}${complete ? " — complete" : ` — ${progress} of ${goal}`}`}
						>
							{complete ? (
								<AchievementGlyph achievement={achievement} complete />
							) : (
								<GoalProgressRing pct={pct} complete={false}>
									<AchievementGlyph
										achievement={achievement}
										complete={false}
									/>
								</GoalProgressRing>
							)}
						</button>
					}
				/>
				<TooltipContent className="max-w-76 px-2.5 py-1.5 text-center">
					<div className="flex flex-col items-center gap-0.5 text-center">
						<span className="font-medium leading-tight">{displayName}</span>
						{body && !isSecret ? (
							<span className="text-[11px] text-background/85 leading-tight">
								{body}
							</span>
						) : isSecret ? (
							<span className="text-[11px] text-background/85 leading-tight">
								Keep going — details unlock when you finish.
							</span>
						) : null}
						<span className="text-[10px] text-background/70 tabular-nums leading-tight">
							{complete ? unlockedLine : `${progress} / ${goal}`}
						</span>
					</div>
				</TooltipContent>
			</Tooltip>
			<span
				className={cn(
					"text-balance text-[11px] leading-snug",
					complete ? "text-muted-foreground" : "text-muted-foreground/80",
				)}
			>
				{displayName}
			</span>
			{!complete ? (
				<span className="rounded-full bg-background px-2.5 py-0.5 font-medium text-[10px] text-muted-foreground tabular-nums">
					{progress} / {goal}
				</span>
			) : (
				<span className="rounded-full bg-background px-2.5 py-0.5 font-medium text-[10px] text-desert-orange/90 tabular-nums">
					Done
				</span>
			)}
		</li>
	);
}

/**
 * Long-term goals — milestone tray + ring progress (matches badges tab / profile milestones).
 */
export function AchievementsGoalsPanel({
	rows,
}: {
	rows: AchievementLobbyRow[];
}) {
	const visible = rows.filter(shouldShowGoal);
	const unlockedCount = visible.filter((r) =>
		Boolean(r.userAchievement?.unlockedAt),
	).length;

	if (visible.length === 0) {
		return (
			<div className="flex min-h-[min(42svh,28rem)] flex-1 flex-col items-center justify-center px-4 py-12 text-center">
				<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
					No goals to show yet
				</p>
				<p className="mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
					Log films, publish reviews, and grow your circle — progress appears
					here as you go.
				</p>
			</div>
		);
	}

	const inProgress = visible.filter((r) => !r.userAchievement?.unlockedAt);
	const complete = visible.filter((r) => r.userAchievement?.unlockedAt);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-8">
			<p className="text-center text-muted-foreground text-sm tabular-nums">
				<span className="text-foreground">{unlockedCount}</span>
				<span className="text-muted-foreground">
					{" "}
					of {visible.length} complete
				</span>
			</p>

			<TooltipProvider delay={280} closeDelay={80}>
				{inProgress.length > 0 ? (
					<section className="space-y-4">
						<h3 className="text-center font-medium text-[11px] text-muted-foreground tracking-wide">
							In progress
						</h3>
						<ul
							className="flex max-w-full flex-wrap justify-center gap-x-7 gap-y-6 overflow-visible px-1"
							aria-label="Goals in progress"
						>
							{inProgress.map((row) => (
								<GoalTile key={row.achievement.id} row={row} />
							))}
						</ul>
					</section>
				) : null}

				{complete.length > 0 ? (
					<section className="space-y-4">
						<h3 className="text-center font-medium text-[11px] text-muted-foreground tracking-wide">
							Complete
						</h3>
						<ul
							className="flex max-w-full flex-wrap justify-center gap-x-7 gap-y-6 overflow-visible px-1"
							aria-label="Completed goals"
						>
							{complete.map((row) => (
								<GoalTile key={row.achievement.id} row={row} />
							))}
						</ul>
					</section>
				) : null}
			</TooltipProvider>
		</div>
	);
}
