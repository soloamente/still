"use client";

import { cn } from "@still/ui/lib/utils";
import { MessageCircle } from "lucide-react";
import { useCallback } from "react";
import {
	type ProfileReviewRow,
	ProfileReviewTile,
} from "@/components/profile/profile-reviews-panel";
import { ProfileSocialEmpty } from "@/components/profile/profile-social-empty";
import { fetchProfileReviews } from "@/lib/fetch-profile-reviews-client";
import { useInfinitePager } from "@/lib/use-infinite-pager";

/**
 * Patron reviews tab — paginated grid; loads all visible reviews via infinite scroll.
 */
export function ProfileReviewsInfinitePanel({
	handle,
	isMe = false,
}: {
	handle: string;
	isMe?: boolean;
}) {
	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const res = await fetchProfileReviews(handle, page, { signal });
			if ("error" in res) return { error: true as const };
			const nextCursor = page < res.total_pages ? page + 1 : null;
			return { items: res.results, nextCursor };
		},
		[handle],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		ProfileReviewRow,
		number
	>({
		seeds: [],
		initialCursor: 1,
		loadMore,
		getKey: (row) => row.review.id,
	});

	if (footerState === "loading" && items.length === 0) {
		return (
			<ul className="grid w-full gap-4 md:grid-cols-2" aria-busy="true">
				{["a", "b", "c", "d"].map((slotId) => (
					<li
						key={`reviews-skeleton-${slotId}`}
						className="min-h-44 animate-pulse rounded-[1.75rem] bg-background"
					/>
				))}
			</ul>
		);
	}

	if (items.length === 0 && footerState === "exhausted") {
		return (
			<ProfileSocialEmpty
				icon={MessageCircle}
				title="No reviews yet"
				body="Published write-ups show up here with ratings, reactions, and the film they are about."
			/>
		);
	}

	return (
		<div className="min-h-0 w-full">
			<ul className="grid w-full gap-4 md:grid-cols-2">
				{items.map((row) => (
					<li key={row.review.id} className="min-w-0">
						<ProfileReviewTile row={row} isMe={isMe} />
					</li>
				))}
			</ul>
			{footerState !== "exhausted" ? (
				<div
					ref={sentinelRef}
					className={cn(
						"flex min-h-12 items-center justify-center py-4 text-muted-foreground text-sm",
						footerState === "loading" && "animate-pulse",
					)}
					aria-hidden={footerState === "idle"}
				>
					{footerState === "loading" ? (
						"Loading more reviews…"
					) : footerState === "error" ? (
						<button
							type="button"
							className="rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm"
							onClick={retry}
						>
							Could not load reviews — try again
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
