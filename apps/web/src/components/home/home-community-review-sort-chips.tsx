"use client";

import { cn } from "@still/ui/lib/utils";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import {
	type HomeCommunityReviewSort,
	parseHomeCommunityReviewSort,
} from "@/lib/home-community-review-sort";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

const REVIEW_SORT_CHIPS: readonly {
	id: HomeCommunityReviewSort;
	label: string;
}[] = [
	{ id: "all", label: "All reviews" },
	{ id: "most-liked", label: "Most liked" },
];

/** Secondary sort on Community **Reviews** — chronological vs engagement-ranked leaders. */
export function HomeCommunityReviewSortChips() {
	const searchParams = useSearchParams();
	const { feed, period, rankKind } = useHomeCommunityLobbyParams();
	const { navigate } = useLobbyNavigation();
	const reviewSort = parseHomeCommunityReviewSort(
		searchParams.get("reviewSort"),
	);

	const selectReviewSort = useCallback(
		(next: HomeCommunityReviewSort) => {
			navigate(
				buildHomeLobbyHref({
					browse: "community",
					sort: "reviews",
					period,
					rankKind,
					reviewSort: next,
				}),
			);
		},
		[navigate, period, rankKind],
	);

	if (feed !== "reviews") return null;

	return (
		<div
			className="mx-auto mb-4 flex max-w-2xl justify-center"
			role="toolbar"
			aria-label="Review sort"
		>
			<div className="flex flex-nowrap gap-1 rounded-full bg-background p-1">
				{REVIEW_SORT_CHIPS.map(({ id, label }) => {
					const active = reviewSort === id;
					return (
						<button
							key={id}
							type="button"
							aria-current={active ? "page" : undefined}
							className={cn(
								"relative inline-flex min-h-9 items-center justify-center rounded-full px-3.5 py-1.5 font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
								active
									? "bg-card text-foreground"
									: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
							)}
							onClick={() => selectReviewSort(id)}
						>
							{label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
