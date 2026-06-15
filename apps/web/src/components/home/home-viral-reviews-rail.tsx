"use client";

import { cn } from "@still/ui/lib/utils";
import { Film, Heart } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

import { ReviewBodyWithMentions } from "@/components/review/review-body-with-mentions";
import {
	useReviewDetail,
	useReviewEngagementCounts,
} from "@/components/review/review-detail-sheet";
import type { HomeCommunityReviewRow } from "@/lib/home-community-core-fetch";
import { isListCoverProxySrc } from "@/lib/list-cover-image";
import { shouldShowReviewBody } from "@/lib/review-audio-fields";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";
import { useHorizontalScrollFades } from "@/lib/use-horizontal-scroll-fades";

/** Poster depth — pure black/white outline per make-interfaces-feel-better. */
const VIRAL_RAIL_POSTER_OUTLINE =
	"outline outline-1 outline-black/10 dark:outline-white/10";

/** Fixed editorial tile — stretch to the tallest card in the row. */
const VIRAL_RAIL_CELL_CLASSNAME =
	"flex w-44 shrink-0 self-stretch flex-col sm:w-48";

function ViralReviewRailCard({ review }: { review: HomeCommunityReviewRow }) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const { likesCount } = useReviewEngagementCounts(review.id, {
		likesCount: review.likesCount,
		commentsCount: review.commentsCount,
	});
	const listing = review.listing;
	const showReviewBody = shouldShowReviewBody(review);
	const headline = review.title?.trim() || null;
	const hasBodyCopy = showReviewBody && review.body.trim().length > 0;

	return (
		<button
			type="button"
			className={cn(
				"flex h-full min-h-0 w-full flex-col rounded-2xl bg-background p-3 text-left",
				"transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
			)}
			aria-haspopup="dialog"
			aria-label={headline ? `Read review: ${headline}` : "Read review"}
			onClick={() => {
				trackSenseProductEvent("viral_review.tapped", { reviewId: review.id });
				openReviewDetail({
					reviewId: review.id,
					preview: {
						id: review.id,
						userId: review.userId,
						title: review.title,
						body: review.body,
						rating: review.rating,
						likesCount,
						commentsCount: review.commentsCount,
						publishedAt: review.publishedAt,
						audioUrl: review.audioUrl,
						audioDurationMs: review.audioDurationMs,
					},
				});
			}}
		>
			{/* Poster slot is always present so every tile shares the same vertical rhythm. */}
			<div
				className={cn(
					"relative mb-3 aspect-2/3 w-full shrink-0 overflow-hidden rounded-xl bg-card",
					VIRAL_RAIL_POSTER_OUTLINE,
				)}
			>
				{listing?.posterUrl ? (
					<Image
						src={listing.posterUrl}
						alt={listing.title}
						fill
						sizes="(max-width: 640px) 176px, 192px"
						className="object-cover"
						unoptimized={isListCoverProxySrc(listing.posterUrl)}
					/>
				) : (
					<div
						className="grid size-full place-items-center bg-soft-stone text-muted-foreground"
						aria-hidden
					>
						<Film className="size-5 opacity-70" />
					</div>
				)}
			</div>

			<div className="flex min-h-0 flex-1 flex-col">
				{/* Headline + body stay grouped; only likes pin to the card foot. */}
				<div className="flex flex-col gap-1">
					{headline ? (
						<p className="line-clamp-3 text-balance font-medium text-foreground text-sm leading-snug">
							{headline}
						</p>
					) : null}
					{hasBodyCopy ? (
						<p
							className={cn(
								"text-pretty font-editorial leading-relaxed",
								headline
									? "line-clamp-2 text-foreground/75 text-xs"
									: "line-clamp-3 text-foreground/85 text-sm",
							)}
						>
							<ReviewBodyWithMentions body={review.body} />
						</p>
					) : null}
				</div>
				<p className="mt-auto flex items-center gap-1.5 pt-3 font-semibold text-foreground text-sm tabular-nums">
					<Heart
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden
					/>
					{likesCount}
				</p>
			</div>
		</button>
	);
}

/** Horizontal rail — top wit-sized reviews by engagement in the active period. */
export function HomeViralReviewsRail({
	reviews,
}: {
	reviews: HomeCommunityReviewRow[];
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const railContentKey = reviews.map((review) => review.id).join("\0");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		reviews.length > 0,
		railContentKey,
	);

	if (reviews.length === 0) return null;

	return (
		<section className="mb-6 w-full min-w-0" aria-label="Most liked reviews">
			<h2 className="mb-3 text-balance text-center font-medium text-foreground text-sm">
				Most liked reviews
			</h2>
			<div className="relative min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card via-card/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-card via-card/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					ref={scrollRef}
					className="scrollbar-none overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					data-lenis-prevent-wheel
				>
					{/* Center when the row fits; scroll when it overflows the lobby. */}
					<div className="flex min-w-full justify-center">
						<ul className="flex w-max items-stretch gap-3">
							{reviews.map((review) => (
								<li key={review.id} className={VIRAL_RAIL_CELL_CLASSNAME}>
									<ViralReviewRailCard review={review} />
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
