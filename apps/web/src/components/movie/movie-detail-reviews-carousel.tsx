"use client";

import { cn } from "@still/ui/lib/utils";
import { Heart, MessageCircle } from "lucide-react";
import Link from "next/link";
import {
	type KeyboardEvent,
	type MouseEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import type { MoviePageReview } from "@/components/movie/movie-detail-explore-tabs";
import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import { ReviewBodyWithMentions } from "@/components/review/review-body-with-mentions";
import {
	useReviewDetail,
	useReviewEngagementCounts,
} from "@/components/review/review-detail-sheet";
import { ReviewEditorialPatronScore } from "@/components/review/review-editorial-patron-score";
import { authClient } from "@/lib/auth-client";
import { useDetailEditorialRailSnap } from "@/lib/detail-editorial-rail-snap";
import {
	REVIEW_SPOILER_REVEAL_CTA,
	shouldMaskReviewSpoilers,
} from "@/lib/review-spoiler-mask";
import { useViewerHasWatchedMovie } from "@/lib/use-viewer-has-watched-movie";

const SPOILER_MASK_POST_CLASS =
	"opacity-65 blur-[var(--page-blur)] motion-reduce:blur-none motion-reduce:opacity-100";

/** One editorial testimonial per viewport — centered via leading/trailing rail spacers. */
const REVIEW_SLIDE_WIDTH_CLASS = "w-[min(36rem,88vw)]";
/** Horizontal edge softening — hides harsh clip where peeking slides meet page padding. */
const REVIEW_RAIL_X_FADE_CLASS =
	"[mask-image:linear-gradient(to_right,transparent_0,black_10rem,black_calc(100%-10rem),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_10rem,black_calc(100%-10rem),transparent_100%)]";

/** Editorial scene height — slides vertically center inside the rail. */
const REVIEW_RAIL_MIN_HEIGHT_CLASS = "min-h-[min(32rem,72vh)]";

/** Space between editorial slides — margin on 2+ items only (spacers must stay flush). */
const REVIEW_SLIDE_GAP_CLASS = "ml-28 sm:ml-36 md:ml-40";

/** Half the leftover scrollport width so the first/last snap targets sit centered. */
const REVIEW_RAIL_EDGE_SPACER_CLASS =
	"w-[max(1.25rem,calc((100cqw-min(36rem,88vw))/2))]";

function ReviewRailEdgeSpacer() {
	return (
		<li
			aria-hidden
			className={cn(
				REVIEW_RAIL_EDGE_SPACER_CLASS,
				"pointer-events-none shrink-0 list-none",
			)}
		/>
	);
}

/** Inactive carousel slides — page-slide blur token, separate from hover transition. */
const REVIEW_SLIDE_INACTIVE_CLASS =
	"opacity-45 blur-[3px] scale-[0.98] motion-reduce:blur-none motion-reduce:scale-100";

/** Press feedback on the full slide target — modal scale token. */
const REVIEW_SLIDE_PRESS_CLASS =
	"transition-transform duration-[var(--page-slide-dur)] ease-[var(--page-slide-ease)] motion-reduce:transition-none active:scale-[var(--modal-scale)] motion-reduce:active:scale-100";

/** Large centered quote slide — tap opens the review reader sheet. */
function MovieDetailReviewSlide({
	review,
	isActive,
	hasWatchedMovie,
	currentUserId,
	className,
}: {
	review: MoviePageReview;
	isActive: boolean;
	hasWatchedMovie: boolean;
	currentUserId: string | null;
	className?: string;
}) {
	const openReviewDetail = useReviewDetail((s) => s.open);
	const { likesCount, commentsCount } = useReviewEngagementCounts(review.id, {
		likesCount: review.likesCount,
		commentsCount: review.commentsCount,
	});
	const author = review.author;
	const bodyRef = useRef<HTMLParagraphElement>(null);
	const [bodyTruncated, setBodyTruncated] = useState(false);
	const [spoilerRevealed, setSpoilerRevealed] = useState(false);
	const isOwnReview = currentUserId != null && review.userId === currentUserId;
	const spoilerMasked = shouldMaskReviewSpoilers({
		containsSpoilers: review.containsSpoilers,
		hasWatchedMovie,
		isOwnReview,
		revealed: spoilerRevealed,
	});

	// Blur + “See full review” only when line-clamp actually cuts the body.
	const bodyMeasureKey = `${review.id}\0${review.body}\0${isActive ? "1" : "0"}`;
	useEffect(() => {
		const el = bodyRef.current;
		if (!el) return;
		void bodyMeasureKey;

		const measure = () => {
			setBodyTruncated(el.scrollHeight > el.clientHeight + 1);
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [bodyMeasureKey]);

	const showExpandHint = bodyTruncated || spoilerMasked;

	const handleOpenReview = () => {
		openReviewDetail({
			reviewId: review.id,
			movieId: review.movieId,
			preview: {
				id: review.id,
				title: review.title,
				body: review.body,
				rating: review.rating,
				likesCount: likesCount,
				commentsCount: commentsCount,
				publishedAt: review.publishedAt,
				containsSpoilers: review.containsSpoilers,
				author: author
					? {
							handle: author.handle,
							displayName: author.displayName,
							image: author.image,
						}
					: null,
			},
		});
	};

	const handleReviewAreaClick = (event: MouseEvent<HTMLDivElement>) => {
		// Profile link stays its own destination inside the blurred post.
		if ((event.target as HTMLElement).closest("a")) return;
		if (spoilerMasked) {
			setSpoilerRevealed(true);
			return;
		}
		handleOpenReview();
	};

	const handleReviewAreaKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		if (spoilerMasked) {
			setSpoilerRevealed(true);
			return;
		}
		handleOpenReview();
	};

	return (
		<li
			data-review-slide
			className={cn(
				REVIEW_SLIDE_WIDTH_CLASS,
				"flex min-w-0 shrink-0 list-none items-center justify-center self-stretch",
				className,
			)}
		>
			{/* Body hover blurs the full post; whole slide stays the click target. */}
			{/* biome-ignore lint/a11y/useSemanticElements: patron profile Link must stay inside the blurred post */}
			<div
				role="button"
				tabIndex={0}
				className={cn(
					"t-review-slide group/review flex h-full min-h-full w-full cursor-pointer select-none flex-col items-center justify-center px-3 py-4 text-center sm:px-4",
					spoilerMasked && "t-review-slide--spoiler-masked",
					bodyTruncated && !spoilerMasked && "t-review-slide--truncated",
					REVIEW_SLIDE_PRESS_CLASS,
					"[-webkit-tap-highlight-color:transparent]",
					!isActive && REVIEW_SLIDE_INACTIVE_CLASS,
				)}
				aria-label={
					spoilerMasked
						? REVIEW_SPOILER_REVEAL_CTA
						: review.title
							? `Read review: ${review.title}`
							: "Read review"
				}
				onClick={handleReviewAreaClick}
				onKeyDown={handleReviewAreaKeyDown}
			>
				<div
					className={cn(
						"t-review-slide__post",
						spoilerMasked && SPOILER_MASK_POST_CLASS,
					)}
				>
					{review.rating != null ? (
						<div className="mt-6">
							<ReviewEditorialPatronScore rating={review.rating} />
						</div>
					) : null}

					{review.title ? (
						<h3
							className={cn(
								"max-w-prose text-balance px-3 font-semibold font-serif text-foreground text-xl leading-snug tracking-tight sm:px-4 sm:text-2xl",
								review.rating != null ? "mt-3" : "mt-6",
							)}
						>
							{review.title}
						</h3>
					) : null}

					<p
						ref={bodyRef}
						data-review-body=""
						className={cn(
							"w-full max-w-prose px-2 py-1 text-center tracking-tight outline-none",
							bodyTruncated && "line-clamp-8",
							review.title
								? "mt-1.5 text-pretty font-editorial font-normal text-foreground/90 text-xl leading-normal sm:text-2xl"
								: "mt-3 text-pretty font-sans font-semibold text-foreground text-xl leading-normal sm:text-2xl",
						)}
					>
						<ReviewBodyWithMentions body={review.body} />
					</p>

					{author ? (
						<div className="mt-8 flex flex-col items-center gap-2 text-center">
							<Link
								href={`/profile/${author.handle}`}
								className="rounded-full outline-none transition-transform duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.96] motion-reduce:active:scale-100"
								onClick={(event) => event.stopPropagation()}
							>
								<PatronPortraitAvatar
									handle={author.handle}
									avatarUrl={author.image}
									name={author.displayName}
									width={80}
									height={80}
									className="size-13 rounded-full"
								/>
							</Link>
							{/* Display name, handle, and engagement counts read as one byline block. */}
							<div className="flex flex-col items-center gap-0 text-center">
								<Link
									href={`/profile/${author.handle}`}
									className="font-medium text-foreground text-sm leading-snug outline-none transition-transform duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.96] motion-reduce:active:scale-100"
									onClick={(event) => event.stopPropagation()}
								>
									{author.displayName}
								</Link>
								<Link
									href={`/profile/${author.handle}`}
									className="text-muted-foreground text-xs leading-snug outline-none transition-transform duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.96] motion-reduce:active:scale-100"
									onClick={(event) => event.stopPropagation()}
								>
									@{author.handle}
								</Link>
								<div className="mt-1.5 flex min-h-6 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground text-xs tabular-nums">
									<span className="inline-flex items-center gap-1">
										<Heart className="size-3 opacity-70" aria-hidden />
										{likesCount}
									</span>
									<span className="inline-flex items-center gap-1">
										<MessageCircle className="size-3 opacity-70" aria-hidden />
										{commentsCount}
									</span>
								</div>
							</div>
						</div>
					) : (
						<div className="mt-4 flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 text-muted-foreground text-xs tabular-nums">
							<span className="inline-flex items-center gap-1">
								<Heart className="size-3 opacity-70" aria-hidden />
								{likesCount}
							</span>
							<span className="inline-flex items-center gap-1">
								<MessageCircle className="size-3 opacity-70" aria-hidden />
								{commentsCount}
							</span>
						</div>
					)}
				</div>

				{showExpandHint ? (
					<div aria-hidden className="t-review-slide__cta">
						<span className="t-review-slide__cta-label">
							{spoilerMasked ? REVIEW_SPOILER_REVEAL_CTA : "See full review"}
						</span>
					</div>
				) : null}
			</div>
		</li>
	);
}

/**
 * Movie / TV detail — editorial reviews rail (reference: large centered quote,
 * patron below, horizontal scroll with first slide centered).
 */
export function MovieDetailReviewsCarousel({
	movieId,
	reviews,
	className,
}: {
	movieId: number;
	reviews: MoviePageReview[];
	className?: string;
}) {
	const { data: session } = authClient.useSession();
	const currentUserId = session?.user?.id ?? null;
	const { hasWatched } = useViewerHasWatchedMovie(movieId);
	const { railRef, activeSlideIndex } = useDetailEditorialRailSnap({
		slideCount: reviews.length,
		slideSelector: "[data-review-slide]",
	});

	if (reviews.length === 0) {
		return (
			<p className="text-center text-muted-foreground text-sm">
				No reviews yet. Be the first to write one.
			</p>
		);
	}

	return (
		<section
			className={cn(
				// Break out of about-column padding; on xl+ use the nav gutter too so the rail spans the card width.
				"relative isolate",
				"-mx-2.5 w-[calc(100%+1.25rem)] sm:-mx-4 sm:w-[calc(100%+2rem)] md:-mx-5 md:w-[calc(100%+2.5rem)]",
				"xl:-mx-28 xl:w-[calc(100%+14rem)] 2xl:-mx-32 2xl:w-[calc(100%+16rem)]",
				className,
			)}
			aria-label="Patron reviews"
		>
			{/* Card-toned scrims reinforce the mask at the layout inset (page padding). */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-linear-to-r from-0% from-card via-30% via-card/90 to-transparent sm:w-32 md:w-40 xl:w-48"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-linear-to-l from-0% from-card via-30% via-card/90 to-transparent sm:w-32 md:w-40 xl:w-48"
			/>

			<div
				ref={railRef}
				className={cn(
					"@container flex min-w-0 overflow-x-auto overscroll-x-contain",
					REVIEW_RAIL_MIN_HEIGHT_CLASS,
					REVIEW_RAIL_X_FADE_CLASS,
					"scrollbar-none items-center [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
				)}
			>
				<ul className="flex min-h-full w-max items-stretch">
					<ReviewRailEdgeSpacer />
					{reviews.map((review, index) => (
						<MovieDetailReviewSlide
							key={review.id}
							review={review}
							isActive={index === activeSlideIndex}
							hasWatchedMovie={hasWatched}
							currentUserId={currentUserId}
							className={index > 0 ? REVIEW_SLIDE_GAP_CLASS : undefined}
						/>
					))}
					<ReviewRailEdgeSpacer />
				</ul>
			</div>
		</section>
	);
}
