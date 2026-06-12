"use client";

import IconHeartFilled from "@still/ui/icons/heart-filled";
import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { DetailMotionLink } from "@/components/movie/detail-motion-pressable";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { useCreatorAnalytics } from "@/lib/use-creator-analytics";

const actionPillClassName = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full bg-card px-3 py-1.5 font-semibold text-foreground text-xs",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

function formatUpdatedAt(iso: string) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/**
 * Curator reach summary on Achievements (SN.13) — only renders for designated curators.
 */
export function AchievementsCreatorAnalyticsCard() {
	const { analytics, loading } = useCreatorAnalytics();

	if (loading) {
		return (
			<div className="mx-auto w-full max-w-md" role="status" aria-live="polite">
				<span className="sr-only">Loading curator stats</span>
				<div
					className="h-40 animate-pulse rounded-2xl bg-muted/30"
					aria-hidden
				/>
			</div>
		);
	}

	if (!analytics) return null;

	const { stats, topLists } = analytics;

	return (
		<div className="mx-auto w-full max-w-md rounded-2xl bg-background px-5 py-4">
			<div className="space-y-4">
				<div className="text-center">
					<div className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 font-medium text-[11px] text-desert-orange tracking-wide">
						<IconListPlay
							className="size-3.5 shrink-0 opacity-90"
							aria-hidden
						/>
						Curator reach
					</div>
				</div>

				<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{[
						{ label: "Public lists", value: stats.publicListsCount },
						{ label: "Described", value: stats.describedPublicListsCount },
						{ label: "List likes", value: stats.totalListLikes },
						{ label: "Review likes", value: stats.totalReviewLikes },
					].map((row) => (
						<div key={row.label} className="rounded-xl bg-card/80 px-3 py-2.5">
							<dt className="text-[11px] text-muted-foreground">{row.label}</dt>
							<dd className="font-semibold text-foreground text-lg tabular-nums tracking-tight">
								{row.value}
							</dd>
						</div>
					))}
				</dl>

				{topLists.length > 0 ? (
					<div className="space-y-2">
						<p className="text-center font-medium text-foreground text-xs">
							Top lists
						</p>
						<ul className="space-y-1.5">
							{topLists.map((row) => {
								const updated = formatUpdatedAt(row.updatedAt);
								return (
									<li key={row.id}>
										<Link
											href={`/lists/${row.id}`}
											className={cn(
												"flex items-center justify-between gap-3 rounded-xl bg-card/80 px-3 py-2.5 transition-colors duration-200 ease-out motion-reduce:transition-none",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
										>
											<span className="min-w-0 text-left">
												<span className="block truncate font-medium text-foreground text-sm">
													{row.title}
												</span>
												{updated ? (
													<span className="text-[11px] text-muted-foreground">
														Updated {updated}
														{row.hasDescription ? " · Described" : ""}
													</span>
												) : null}
											</span>
											{row.likesCount > 0 ? (
												<span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs tabular-nums">
													<IconHeartFilled
														className="size-3 text-foreground/70"
														aria-hidden
													/>
													{row.likesCount}
												</span>
											) : null}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				) : null}

				<div className="flex justify-center pt-1">
					<DetailMotionLink href="/lists" className={actionPillClassName}>
						Manage lists
					</DetailMotionLink>
				</div>
			</div>
		</div>
	);
}
