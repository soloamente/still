"use client";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
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
	return (
		<SegmentedPillToolbar
			layoutId="search-dialog-category-pill"
			aria-label="Show"
			value={active}
			onChange={(category) => {
				if (categories[category].count === 0) return;
				onSelect(category);
			}}
			options={enabled.map((category) => {
				const count = categories[category].count;
				return {
					id: category,
					label: (
						<span className="inline-flex items-center gap-2">
							{CATEGORY_LABEL[category]}
							<span className="tabular-nums opacity-70">{count}</span>
						</span>
					),
					disabled: count === 0,
				};
			})}
			compact
			indicatorClassName="bg-background"
			className="flex-wrap justify-start gap-2 bg-transparent p-0"
			optionClassName="px-3 py-2"
		/>
	);
}
