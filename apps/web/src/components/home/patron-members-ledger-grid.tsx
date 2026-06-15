"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MoviePoster } from "@/components/movie/movie-poster";
import { useReviewDetail } from "@/components/review/review-detail-sheet";
import { listPosterDisplayUrl } from "@/lib/list-cover-image";
import type {
	MembersLeaderboardLedgerItem,
	MembersLeaderboardLedgerLogItem,
	MembersLeaderboardLedgerReviewItem,
} from "@/lib/members-leaderboard-item-types";
import type { MembersLeaderboardSort } from "@/lib/members-leaderboard-types";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

const LEDGER_POSTER_FRAME_CLASSNAME = "rounded-2xl border-0";

function openReviewFromLedgerItem(
	item: MembersLeaderboardLedgerReviewItem | MembersLeaderboardLedgerLogItem,
	openReviewDetail: ReturnType<typeof useReviewDetail.getState>["open"],
) {
	if (!item.reviewId || !item.reviewBody) return;
	openReviewDetail({
		reviewId: item.reviewId,
		movieId: item.movieId,
		preview: {
			id: item.reviewId,
			userId: item.userId,
			title: item.reviewTitle,
			body: item.reviewBody,
			rating: item.rating,
			likesCount: item.likesCount ?? 0,
			commentsCount: item.commentsCount ?? 0,
			publishedAt: item.publishedAt ?? item.sortAt,
			containsSpoilers: item.containsSpoilers,
		},
	});
}

/**
 * Review posters in the patron contribution ledger — tap opens the review reader.
 */
export function PatronMembersLedgerGrid({
	items,
	sort,
}: {
	items: MembersLeaderboardLedgerItem[];
	sort: MembersLeaderboardSort;
}) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const router = useRouter();

	if (!items.length) {
		return (
			<p
				className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
				role="status"
			>
				{sort === "lists"
					? "No public lists in this window."
					: sort === "popular"
						? "No diary logs in this window."
						: "No reviews in this window."}
			</p>
		);
	}

	return (
		<div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5">
			{items.map((item, index) => {
				if (item.itemKind === "list") {
					const posterUrl =
						listPosterDisplayUrl(
							item.listId,
							item.coverImageUrl ?? item.posterPath,
							item.createdAt,
							"w342",
						) ?? null;

					return (
						<div key={item.itemKey} className="min-w-0 text-center">
							<Link
								href={`/lists/${item.listId}`}
								className={cn(
									"group relative z-0 block w-full min-w-0 overflow-visible",
									"transition-[box-shadow,z-index] duration-200 ease-out",
									"[@media(hover:hover)]:hover:z-[1] [@media(hover:hover)]:hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent)]",
								)}
								title={`Open list: ${item.title}`}
							>
								<MoviePoster
									movieId={0}
									title={item.title}
									posterUrl={posterUrl}
									linkable={false}
									hoverEffect="elevation"
									frameClassName={LEDGER_POSTER_FRAME_CLASSNAME}
									priority={index < 6}
								/>
							</Link>
							<p className="mt-1 line-clamp-2 text-center text-[10px] text-muted-foreground leading-snug">
								{item.title}
							</p>
						</div>
					);
				}

				const posterUrl = tmdbPosterUrlFromPath(item.posterPath, "w342");
				const hasReview = Boolean(item.reviewId && item.reviewBody);

				return (
					<div key={item.itemKey} className="min-w-0 text-center">
						<button
							type="button"
							className={cn(
								"group relative z-0 block w-full min-w-0 overflow-visible text-left",
								"cursor-pointer transition-[box-shadow,z-index,transform] duration-150 ease-out",
								"active:scale-[0.96] motion-reduce:active:scale-100",
								"[@media(hover:hover)]:hover:z-[1] [@media(hover:hover)]:hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent)]",
							)}
							aria-haspopup={hasReview ? "dialog" : undefined}
							aria-label={
								hasReview
									? item.reviewTitle
										? `Read review: ${item.reviewTitle}`
										: `Read review of ${item.listingTitle}`
									: `Open ${item.listingTitle}`
							}
							onClick={(event) => {
								event.preventDefault();
								if (hasReview) {
									openReviewFromLedgerItem(item, openReviewDetail);
									return;
								}
								router.push(`/movies/${item.movieId}`);
							}}
						>
							<MoviePoster
								movieId={item.movieId}
								title={item.listingTitle}
								posterUrl={posterUrl}
								linkable={false}
								hoverEffect="elevation"
								frameClassName={LEDGER_POSTER_FRAME_CLASSNAME}
								priority={index < 6}
							/>
						</button>
						<p className="mt-1 line-clamp-2 text-center text-[10px] text-muted-foreground leading-snug">
							{item.listingTitle}
						</p>
					</div>
				);
			})}
		</div>
	);
}
