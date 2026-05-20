"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";

import { MilestoneBadgeGlyph } from "@/components/gamification/milestone-badge-glyph";
import { formatDate } from "@/lib/format";

export type BadgeCatalogRow = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	iconUrl: string | null;
	tier: string;
	category: string;
	points: number;
};

export type EarnedBadgeRow = {
	badge: BadgeCatalogRow;
	userBadge: { awardedAt: string | Date };
};

const CATEGORY_LABEL: Record<string, string> = {
	watch_milestone: "Screenings",
	social: "Community",
	curator: "Lists",
	reviewer: "Reviews",
	explorer: "Explorer",
};

function parseAwardDate(value: string | Date): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function formatAwardedLine(
	value: string | Date | null | undefined,
): string | null {
	if (value == null) return null;
	const d = parseAwardDate(value);
	if (!d) return "Awarded — date unavailable";
	return `Awarded ${formatDate(d)}`;
}

function categoryLabel(category: string): string {
	return CATEGORY_LABEL[category] ?? category.replaceAll("_", " ");
}

/**
 * Full badge catalog — earned tiles match profile milestone tray; locked tiles stay muted.
 */
export function AchievementsBadgesPanel({
	catalog,
	earned,
}: {
	catalog: BadgeCatalogRow[];
	earned: EarnedBadgeRow[];
}) {
	const earnedById = new Map(
		earned.map((row) => [row.badge.id, row.userBadge] as const),
	);

	const byCategory = new Map<string, BadgeCatalogRow[]>();
	for (const badge of catalog) {
		const key = badge.category;
		const list = byCategory.get(key) ?? [];
		list.push(badge);
		byCategory.set(key, list);
	}

	const categories = [...byCategory.keys()].sort((a, b) =>
		categoryLabel(a).localeCompare(categoryLabel(b)),
	);

	if (catalog.length === 0) {
		return (
			<div className="flex min-h-[min(42svh,28rem)] flex-1 flex-col items-center justify-center px-4 py-12 text-center">
				<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
					Badge catalog is empty
				</p>
				<p className="mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
					Run the server seed job to populate collectibles, then refresh.
				</p>
			</div>
		);
	}

	const earnedCount = earned.length;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-8">
			<p className="text-center text-muted-foreground text-sm tabular-nums">
				<span className="text-foreground">{earnedCount}</span>
				<span className="text-muted-foreground">
					{" "}
					of {catalog.length} collected
				</span>
			</p>

			<TooltipProvider delay={280} closeDelay={80}>
				{categories.map((category) => {
					const badges = byCategory.get(category) ?? [];
					return (
						<section key={category} className="space-y-4">
							<h3 className="text-center font-medium text-[11px] text-muted-foreground tracking-wide">
								{categoryLabel(category)}
							</h3>
							<ul
								className="flex max-w-full flex-wrap justify-center gap-x-7 gap-y-5 overflow-visible px-1"
								aria-label={`${categoryLabel(category)} badges`}
							>
								{badges.map((badge) => {
									const award = earnedById.get(badge.id);
									const isEarned = Boolean(award);
									const body = badge.description?.trim();
									return (
										<li
											key={badge.id}
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
																isEarned &&
																	"[@media(hover:hover)]:group-hover:scale-[1.04]",
															)}
															aria-label={`${badge.name}${isEarned ? "" : " — locked"}`}
														>
															<MilestoneBadgeGlyph
																iconUrl={badge.iconUrl}
																tier={badge.tier}
																name={badge.name}
																locked={!isEarned}
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
														<span className="text-[10px] text-background/70 tabular-nums leading-tight">
															{isEarned
																? formatAwardedLine(award?.awardedAt)
																: "Not earned yet"}
														</span>
													</div>
												</TooltipContent>
											</Tooltip>
											<span
												className={cn(
													"text-balance text-[11px] leading-snug",
													isEarned
														? "text-muted-foreground"
														: "text-muted-foreground/55",
												)}
											>
												{badge.name}
											</span>
										</li>
									);
								})}
							</ul>
						</section>
					);
				})}
			</TooltipProvider>
		</div>
	);
}
