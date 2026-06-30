"use client";

import { cn } from "@still/ui/lib/utils";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { SearchCategory } from "@/lib/search-active-category";
import type { CategoryCount } from "@/lib/use-search-category-results";

const CATEGORY_LABEL: Record<SearchCategory, string> = {
	films: "Films",
	tv: "TV shows",
	castcrew: "Cast & Crew",
	lists: "Lists",
	members: "Members",
};

/** Single-select category pills with result counts; empty categories are dimmed and inert. */
export function SearchDialogCategoryPills({
	enabled,
	active,
	categories,
	onSelect,
}: {
	enabled: SearchCategory[];
	active: SearchCategory;
	categories: Record<SearchCategory, CategoryCount>;
	onSelect: (category: SearchCategory) => void;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	return (
		<LayoutGroup id="search-dialog-category-pill-group">
			<div className="flex flex-wrap gap-2" role="toolbar" aria-label="Show">
				{enabled.map((category) => {
					const isActive = category === active;
					const count = categories[category].count;
					const empty = count === 0;
					return (
						<button
							key={category}
							type="button"
							aria-pressed={isActive}
							aria-disabled={empty}
							disabled={empty}
							className={cn(
								"relative inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-left font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
								isActive
									? "text-foreground"
									: empty
										? "cursor-default text-muted-foreground/40"
										: "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/45 [@media(hover:hover)]:hover:text-foreground",
							)}
							onClick={() => {
								if (!empty) onSelect(category);
							}}
						>
							{isActive ? (
								<motion.span
									layoutId="search-dialog-category-pill"
									className="absolute inset-0 z-0 rounded-full bg-background"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10 inline-flex items-center gap-2">
								{CATEGORY_LABEL[category]}
								<span className="tabular-nums opacity-70">{count}</span>
							</span>
						</button>
					);
				})}
			</div>
		</LayoutGroup>
	);
}
