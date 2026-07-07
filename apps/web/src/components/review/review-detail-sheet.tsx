"use client";

import type { RealtimeEvent } from "@still/realtime";
import { Button } from "@still/ui/components/button";
import { Skeleton } from "@still/ui/components/skeleton";
import { TooltipProvider } from "@still/ui/components/tooltip";
import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconTrashXmarkFill from "@still/ui/icons/trash-xmark-fill";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailIconTooltip } from "@/components/movie/detail-icon-tooltip";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import type { MovieDetailHeroSlide } from "@/components/movie/movie-detail-hero-media";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { ReviewAddToShowcaseButton } from "@/components/review/review-add-to-showcase-button";
import { ReviewVoiceAttachment } from "@/components/review/review-audio-player";
import { ReviewBodyWithMentions } from "@/components/review/review-body-with-mentions";
import { useReviewComposer } from "@/components/review/review-composer";
import { ReviewDeleteConfirmDialog } from "@/components/review/review-delete-confirm-dialog";
import { ReviewEditorialPatronScore } from "@/components/review/review-editorial-patron-score";
import { ReviewPinToProfileButton } from "@/components/review/review-pin-to-profile-button";
import { ReviewReaderStillSection } from "@/components/review/review-reader-still-section";
import { ReviewRealtimeSubscriber } from "@/components/review/review-realtime-subscriber";
import { ReviewSpoilerGuard } from "@/components/review/review-spoiler-guard";
import { VisibilityChip } from "@/components/review/visibility-chip";
import {
	type CommentRow,
	CommentsThread,
	normalizeCommentRows,
} from "@/components/social/comments-thread";
import {
	ReactionsBar,
	type ReviewReactionSnapshot,
} from "@/components/social/reactions-bar";
import { StaffContentActions } from "@/components/staff/staff-content-actions";
import { api } from "@/lib/api";
import { APP_MEMBER_LABEL } from "@/lib/app-brand";
import { authClient } from "@/lib/auth-client";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { formatDistanceToNowStrict } from "@/lib/format";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";
import { shouldShowReviewBody } from "@/lib/review-audio-fields";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";
import { useViewerHasWatchedMovie } from "@/lib/use-viewer-has-watched-movie";

/** Avatar byline pill + handle-row icon buttons share one height. */
const REVIEW_READER_HEADER_PILL_CLASS =
	"min-h-12 items-center rounded-full bg-background";

const REVIEW_READER_HEADER_ICON_BUTTON_CLASS = cn(
	"!size-12 rounded-[var(--radius-pill)] bg-background text-muted-foreground",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

const REVIEW_READER_HEADER_DELETE_ICON_BUTTON_CLASS = cn(
	"!size-12 rounded-[var(--radius-pill)] bg-background text-destructive",
	"[@media(hover:hover)]:hover:bg-destructive/10 [@media(hover:hover)]:hover:text-destructive",
);

/** Patron identity shown in the drawer header while detail loads. */
export type ReviewAuthorPreview = {
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
};

/** Card / list preview fields — shown instantly while the sheet loads full detail. */
export type ReviewPreview = {
	id: string;
	/** Author id — enables owner actions before full detail finishes loading. */
	userId?: string;
	title: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
	containsSpoilers?: boolean;
	audioUrl?: string | null;
	audioDurationMs?: number | null;
	author?: ReviewAuthorPreview | null;
};

type OpenArgs = {
	reviewId: string;
	movieId?: number;
	preview: ReviewPreview;
};

/** Patches list/card counts after reactions in the reader drawer. */
export type ReviewEngagementPatch = {
	likesCount: number;
	dislikesCount?: number;
	commentsCount?: number;
};

type Store = {
	isOpen: boolean;
	args: OpenArgs | null;
	/** Stale-safe engagement overrides keyed by review id. */
	engagementByReviewId: Record<string, ReviewEngagementPatch>;
	open: (args: OpenArgs) => void;
	close: () => void;
	clearArgs: () => void;
	setReviewEngagement: (reviewId: string, patch: ReviewEngagementPatch) => void;
};

export const useReviewDetail = create<Store>((set) => ({
	isOpen: false,
	args: null,
	engagementByReviewId: {},
	open: (args) => set({ isOpen: true, args }),
	close: () => set({ isOpen: false }),
	clearArgs: () => set({ args: null }),
	setReviewEngagement: (reviewId, patch) =>
		set((state) => ({
			engagementByReviewId: {
				...state.engagementByReviewId,
				[reviewId]: {
					...state.engagementByReviewId[reviewId],
					...patch,
				},
			},
		})),
}));

/** Merge server counts with any engagement changes from the review reader drawer. */
export function useReviewEngagementCounts(
	reviewId: string,
	fallback: { likesCount: number; commentsCount: number },
) {
	const patch = useReviewDetail((s) => s.engagementByReviewId[reviewId]);
	return {
		likesCount: patch?.likesCount ?? fallback.likesCount,
		commentsCount: patch?.commentsCount ?? fallback.commentsCount,
	};
}

type ReviewDetailPayload = {
	review: {
		id: string;
		userId: string;
		movieId: number;
		logId: string | null;
		title: string | null;
		body: string;
		rating: number | null;
		likesCount: number;
		dislikesCount: number;
		commentsCount: number;
		containsSpoilers: boolean;
		publishedAt: string;
		stillSlideKey?: string | null;
		audioUrl?: string | null;
		audioDurationMs?: number | null;
		visibility?: "public" | "followers" | "friends" | "private";
	};
	movie: {
		tmdbId: number;
		title: string;
		posterPath: string | null;
		year: number | null;
	} | null;
	authorProfile: { displayName: string; handle: string | null } | null;
	author: ReviewAuthorPreview | null;
	screenshots?: MovieDetailHeroSlide[];
	selectedStill?: MovieDetailHeroSlide | null;
	liked: boolean;
	disliked: boolean;
};

/** Eden may deserialize DB timestamps as Date; reader state keeps ISO strings. */
function normalizeReviewDetailPayload(
	data: unknown,
): ReviewDetailPayload | null {
	if (!data || typeof data !== "object") return null;
	const entry = data as {
		review?: Omit<ReviewDetailPayload["review"], "publishedAt"> & {
			publishedAt?: string | Date;
		};
		movie?: ReviewDetailPayload["movie"];
		authorProfile?: ReviewDetailPayload["authorProfile"];
		author?: ReviewAuthorPreview | null;
		screenshots?: MovieDetailHeroSlide[];
		selectedStill?: MovieDetailHeroSlide | null;
		liked?: boolean;
		disliked?: boolean;
		likesCount?: number;
		dislikesCount?: number;
	};
	if (!entry.review) return null;

	const publishedAtRaw = entry.review.publishedAt;
	const publishedAt =
		publishedAtRaw instanceof Date
			? publishedAtRaw.toISOString()
			: typeof publishedAtRaw === "string"
				? publishedAtRaw
				: new Date().toISOString();

	return {
		review: {
			...entry.review,
			publishedAt,
			likesCount: entry.likesCount ?? entry.review.likesCount,
			dislikesCount: entry.dislikesCount ?? entry.review.dislikesCount,
		},
		movie: entry.movie ?? null,
		authorProfile: entry.authorProfile ?? null,
		author: entry.author ?? null,
		screenshots: entry.screenshots,
		selectedStill: entry.selectedStill ?? null,
		liked: entry.liked ?? false,
		disliked: entry.disliked ?? false,
	};
}

function posterSrcFromPath(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w342${fragment}`;
}

function resolveReviewAuthor(
	detail: ReviewDetailPayload | null,
	preview: ReviewPreview | undefined,
): ReviewAuthorPreview | null {
	if (detail?.author) return detail.author;
	if (preview?.author) return preview.author;
	const profile = detail?.authorProfile;
	const handle = profile?.handle?.trim();
	if (!handle) return null;
	return {
		handle,
		displayName: profile?.displayName?.trim() || APP_MEMBER_LABEL,
		image: null,
	};
}

/**
 * Bottom review reader — Vaul drawer with drag handle (same shell as cast filmography).
 * Open via `useReviewDetail().open({ reviewId, preview })`.
 */
export function ReviewDetailRoot() {
	const pathname = usePathname();
	const router = useRouter();
	const { isOpen, args, close, clearArgs } = useReviewDetail();
	const openComposer = useReviewComposer((s) => s.open);
	const { data: session } = authClient.useSession();
	const [detail, setDetail] = useState<ReviewDetailPayload | null>(null);
	/** Seed for CommentsThread mount only — never updated after load (avoids parent/child echo wipe). */
	const [threadSeedComments, setThreadSeedComments] = useState<CommentRow[]>(
		[],
	);
	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [savingStill, setSavingStill] = useState(false);
	const [spoilerRevealed, setSpoilerRevealed] = useState(false);
	const [liveCommentSignal, setLiveCommentSignal] = useState(0);
	const [liveCommentId, setLiveCommentId] = useState<string | null>(null);
	const [liveReactionCounts, setLiveReactionCounts] = useState<{
		likesCount: number;
		dislikesCount: number;
	} | null>(null);
	const liveCommentTrackedRef = useRef(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const reviewScrollKey = `${detail?.review.id ?? ""}-${detail?.review.commentsCount ?? 0}-${loading}-${loadError ?? ""}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		isOpen,
		reviewScrollKey,
	);

	const handleClose = useCallback(() => {
		close();
	}, [close]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (open) return;
			close();
		},
		[close],
	);

	// Keep preview mounted through the Vaul close animation, then drop store args.
	useEffect(() => {
		if (isOpen || !args) return;
		const timer = window.setTimeout(() => clearArgs(), 320);
		return () => window.clearTimeout(timer);
	}, [isOpen, args, clearArgs]);

	const handleEdit = useCallback(() => {
		if (!detail?.review || !detail.movie) return;
		openComposer({
			reviewId: detail.review.id,
			movieId: detail.review.movieId,
			movieTitle: detail.movie.title,
			posterUrl: detail.movie.posterPath,
			diaryLogId: detail.review.logId ?? undefined,
			diaryRatingStored: detail.review.rating,
			initialTitle: detail.review.title,
			initialBody: detail.review.body,
			initialContainsSpoilers: detail.review.containsSpoilers,
			initialVisibility: detail.review.visibility,
			initialStillSlideKey: detail.review.stillSlideKey ?? null,
		});
		handleClose();
	}, [detail, openComposer, handleClose]);

	const handleConfirmDelete = useCallback(async () => {
		const reviewId = detail?.review?.id ?? args?.reviewId;
		if (!reviewId) return;
		setDeleting(true);
		try {
			await api.api.reviews({ id: reviewId }).delete();
			toast.success("Review deleted");
			setDeleteOpen(false);
			handleClose();
			router.refresh();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't delete — try again");
		} finally {
			setDeleting(false);
		}
	}, [args?.reviewId, detail, handleClose, router]);

	const handleSelectStill = useCallback(
		async (slideKey: string) => {
			if (!detail?.review || detail.review.stillSlideKey === slideKey) return;
			setSavingStill(true);
			try {
				const res = await api.api.reviews({ id: detail.review.id }).patch({
					stillSlideKey: slideKey,
				});
				if (res.error) {
					toast.error("Couldn't save movie still");
					return;
				}
				const updated = res.data as { stillSlideKey?: string | null } | null;
				const nextKey = updated?.stillSlideKey ?? slideKey;
				setDetail((current) =>
					current
						? {
								...current,
								review: { ...current.review, stillSlideKey: nextKey },
								selectedStill:
									current.screenshots?.find((slide) => slide.key === nextKey) ??
									null,
							}
						: current,
				);
				router.refresh();
			} catch (err) {
				console.error(err);
				toast.error("Couldn't save movie still");
			} finally {
				setSavingStill(false);
			}
		},
		[detail, router],
	);

	const handleReactionChange = useCallback((state: ReviewReactionSnapshot) => {
		setDetail((current) =>
			current
				? {
						...current,
						liked: state.liked,
						disliked: state.disliked,
						review: {
							...current.review,
							likesCount: state.likes,
							dislikesCount: state.dislikes,
						},
					}
				: current,
		);
		// Keep carousel / community cards in sync after the drawer closes.
		const reviewId = useReviewDetail.getState().args?.reviewId ?? null;
		if (reviewId) {
			useReviewDetail.getState().setReviewEngagement(reviewId, {
				likesCount: state.likes,
				dislikesCount: state.dislikes,
			});
		}
	}, []);

	const handleStaffSpoilerChanged = useCallback(
		(nextContainsSpoilers: boolean) => {
			setDetail((current) =>
				current
					? {
							...current,
							review: {
								...current.review,
								containsSpoilers: nextContainsSpoilers,
							},
						}
					: current,
			);
			if (!nextContainsSpoilers) {
				setSpoilerRevealed(false);
			}
			router.refresh();
		},
		[router],
	);

	useEffect(() => {
		if (!args) {
			setDetail(null);
			setThreadSeedComments([]);
			setLoading(false);
			setLoadError(null);
			setSpoilerRevealed(false);
		}
	}, [args]);

	useEffect(() => {
		if (!isOpen || !args) return;
		setSpoilerRevealed(false);
		const reviewId = args.reviewId;
		let cancelled = false;

		async function load() {
			setLoading(true);
			setLoadError(null);
			try {
				const [reviewRes, commentsRes] = await Promise.all([
					api.api.reviews({ id: reviewId }).get(),
					api.api.comments
						.of({ parentType: "review" })({ parentId: reviewId })
						.get()
						.catch(() => ({ data: [] })),
				]);
				if (cancelled) return;
				if (reviewRes.error) {
					setLoadError("This review is no longer available.");
					return;
				}
				const payload = normalizeReviewDetailPayload(reviewRes.data);
				if (!payload?.review) {
					setLoadError("This review is no longer available.");
					return;
				}
				setDetail(payload);
				setThreadSeedComments(normalizeCommentRows(commentsRes.data));
			} catch (err) {
				console.error(err);
				if (!cancelled) {
					setLoadError("Couldn't load this review — try again.");
					toast.error("Couldn't load review");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [isOpen, args]);

	const preview = args?.preview;
	const review = detail?.review ?? null;
	const movieIdForWatchCheck =
		detail?.movie?.tmdbId ?? detail?.review?.movieId ?? args?.movieId ?? null;
	const { hasWatched: hasWatchedMovie } =
		useViewerHasWatchedMovie(movieIdForWatchCheck);
	// Prefer loaded detail, then card/carousel preview — owner chrome must not wait on GET.
	const reviewUserId = review?.userId ?? preview?.userId ?? null;
	const isReviewOwner = Boolean(
		session?.user?.id && reviewUserId && session.user.id === reviewUserId,
	);
	const viewerRole = session?.user?.role ?? "user";
	const activeReviewId = review?.id ?? args?.reviewId ?? "";

	useEffect(() => {
		if (isOpen) return;
		liveCommentTrackedRef.current = false;
		setLiveCommentSignal(0);
		setLiveCommentId(null);
		setLiveReactionCounts(null);
	}, [isOpen]);

	const handleCommentsChange = useCallback((next: CommentRow[]) => {
		setDetail((current) =>
			current
				? {
						...current,
						review: {
							...current.review,
							commentsCount: next.length,
						},
					}
				: current,
		);
		const reviewId = useReviewDetail.getState().args?.reviewId ?? null;
		if (reviewId) {
			const existing =
				useReviewDetail.getState().engagementByReviewId[reviewId];
			useReviewDetail.getState().setReviewEngagement(reviewId, {
				likesCount: existing?.likesCount ?? 0,
				dislikesCount: existing?.dislikesCount,
				commentsCount: next.length,
			});
		}
	}, []);

	const handleReviewRealtimeEvent = useCallback(
		(event: RealtimeEvent) => {
			if (event.type === "comment.created") {
				if (!liveCommentTrackedRef.current) {
					liveCommentTrackedRef.current = true;
					trackSenseProductEvent("realtime.comment.received_live", {
						reviewId: activeReviewId,
					});
				}
				setLiveCommentId(event.commentId);
				setLiveCommentSignal((current) => current + 1);
				return;
			}

			if (event.type === "reaction.updated") {
				setLiveReactionCounts({
					likesCount: event.likesCount,
					dislikesCount: event.dislikesCount,
				});
				setDetail((current) =>
					current
						? {
								...current,
								review: {
									...current.review,
									likesCount: event.likesCount,
									dislikesCount: event.dislikesCount,
								},
							}
						: current,
				);
				if (activeReviewId) {
					useReviewDetail.getState().setReviewEngagement(activeReviewId, {
						likesCount: event.likesCount,
						dislikesCount: event.dislikesCount,
					});
				}
			}
		},
		[activeReviewId],
	);

	const containsSpoilers =
		review?.containsSpoilers ?? preview?.containsSpoilers ?? false;
	const displayTitle = review?.title ?? preview?.title ?? null;
	const displayBody = review?.body ?? preview?.body ?? "";
	const displayAudioUrl = review?.audioUrl ?? preview?.audioUrl ?? null;
	const displayAudioDurationMs =
		review?.audioDurationMs ?? preview?.audioDurationMs ?? null;
	const displayRating = review?.rating ?? preview?.rating ?? null;
	const displayLikes = review?.likesCount ?? preview?.likesCount ?? 0;
	const displayDislikes = review?.dislikesCount ?? 0;
	const displayComments = review?.commentsCount ?? preview?.commentsCount ?? 0;
	const displayPublishedAt =
		review?.publishedAt ?? preview?.publishedAt ?? new Date().toISOString();
	const displayLiked = detail?.liked ?? false;
	const displayDisliked = detail?.disliked ?? false;
	const showMovieContext =
		Boolean(detail?.movie) && pathname !== `/movies/${detail?.movie?.tmdbId}`;
	const posterUrl = posterSrcFromPath(detail?.movie?.posterPath);
	const movieTitleLine = detail?.movie
		? `${detail.movie.title}${detail.movie.year ? ` (${detail.movie.year})` : ""}`
		: null;
	const displayAuthor = resolveReviewAuthor(detail, preview);
	const movieScreenshots = detail?.screenshots ?? [];
	const selectedStillKey = review?.stillSlideKey ?? null;
	const showStillSection = Boolean(detail) && movieScreenshots.length > 0;
	const showFilmContext =
		showMovieContext &&
		Boolean(posterUrl) &&
		Boolean(movieTitleLine) &&
		Boolean(detail?.movie?.tmdbId);
	/** Poster + title sit above the still when both are shown (not below it). */
	const showFilmContextAboveStill = showFilmContext && showStillSection;
	const showStandaloneFilmContext = showFilmContext && !showStillSection;
	const publishedAgoLabel = `${formatDistanceToNowStrict(new Date(displayPublishedAt))} ago`;
	const hasDisplayRating =
		displayRating != null &&
		formatStoredLogRatingDisplay(displayRating) != null;
	const showReviewBody = shouldShowReviewBody({ body: displayBody });

	if (!args) return null;

	const drawerTitle = displayTitle ?? "Member review";

	const handleLeading = displayAuthor ? (
		<Link
			href={`/profile/${displayAuthor.handle}`}
			onClick={handleClose}
			className={cn(
				"flex max-w-full gap-2 p-2 pr-6 transition-colors duration-150",
				REVIEW_READER_HEADER_PILL_CLASS,
				DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
			)}
		>
			<PatronPortraitWithMetalTier
				handle={displayAuthor.handle}
				avatarUrl={displayAuthor.image}
				name={displayAuthor.displayName}
				width={32}
				height={32}
				className="size-8 shrink-0 rounded-full"
				isAnimated={inferAnimatedFromProfileUrl(
					displayAuthor.image,
					displayAuthor.avatarIsAnimated,
				)}
				diaryMetalTier={displayAuthor.diaryMetalTier ?? null}
			/>
			<span className="min-w-0 text-left">
				<span className="block truncate font-medium text-foreground text-sm leading-snug">
					{displayAuthor.displayName}
				</span>
				<span className="block text-muted-foreground text-xs tabular-nums leading-snug">
					{publishedAgoLabel}
				</span>
			</span>
		</Link>
	) : (
		<span
			className={cn(
				"min-w-0 p-2 pr-4 text-left",
				REVIEW_READER_HEADER_PILL_CLASS,
			)}
		>
			<span className="block font-medium text-muted-foreground text-sm leading-snug">
				{APP_MEMBER_LABEL}
			</span>
			<span className="block text-muted-foreground text-xs tabular-nums leading-snug">
				{publishedAgoLabel}
			</span>
		</span>
	);

	const handleTrailing = args ? (
		<TooltipProvider>
			<div className="flex shrink-0 items-center gap-1">
				{isReviewOwner ? (
					<>
						{reviewUserId ? (
							<ReviewPinToProfileButton
								reviewId={activeReviewId}
								reviewUserId={reviewUserId}
								variant="icon"
								iconButtonClassName={REVIEW_READER_HEADER_ICON_BUTTON_CLASS}
							/>
						) : null}
						{reviewUserId ? (
							<ReviewAddToShowcaseButton
								reviewId={activeReviewId}
								reviewUserId={reviewUserId}
								iconButtonClassName={REVIEW_READER_HEADER_ICON_BUTTON_CLASS}
							/>
						) : null}
						<DetailMotionButtonWrap>
							<DetailIconTooltip
								label={
									detail?.review && detail.movie ? "Edit" : "Loading review…"
								}
							>
								<Button
									type="button"
									variant="ghost"
									size="icon-pill"
									className={REVIEW_READER_HEADER_ICON_BUTTON_CLASS}
									aria-label="Edit review"
									disabled={!detail?.review || !detail.movie}
									onClick={handleEdit}
								>
									<IconPen2Fill
										size="20px"
										className="shrink-0 opacity-90"
										aria-hidden
									/>
								</Button>
							</DetailIconTooltip>
						</DetailMotionButtonWrap>
						<DetailMotionButtonWrap>
							<DetailIconTooltip label="Delete">
								<Button
									type="button"
									variant="ghost"
									size="icon-pill"
									className={REVIEW_READER_HEADER_DELETE_ICON_BUTTON_CLASS}
									aria-label="Delete review"
									onClick={() => setDeleteOpen(true)}
								>
									<IconTrashXmarkFill
										size="20px"
										className="shrink-0 opacity-90"
										aria-hidden
									/>
								</Button>
							</DetailIconTooltip>
						</DetailMotionButtonWrap>
					</>
				) : (
					<StaffContentActions
						variant="header"
						type="review"
						id={activeReviewId}
						role={viewerRole}
						containsSpoilers={detail?.review.containsSpoilers ?? false}
						isRemoved={false}
						onChanged={handleClose}
						onSpoilerChanged={handleStaffSpoilerChanged}
						headerIconButtonClassName={REVIEW_READER_HEADER_ICON_BUTTON_CLASS}
						headerDeleteIconButtonClassName={
							REVIEW_READER_HEADER_DELETE_ICON_BUTTON_CLASS
						}
					/>
				)}
				<ReactionsBar
					appearance="header"
					targetKind="review"
					targetId={review?.id ?? args.reviewId}
					initialLikes={displayLikes}
					initialLiked={displayLiked}
					initialDislikes={displayDislikes}
					initialDisliked={displayDisliked}
					liveReactionCounts={liveReactionCounts}
					iconButtonClassName={REVIEW_READER_HEADER_ICON_BUTTON_CLASS}
					onReactionChange={handleReactionChange}
				/>
			</div>
		</TooltipProvider>
	) : null;

	return (
		<>
			{isOpen && activeReviewId ? (
				<ReviewRealtimeSubscriber
					reviewId={activeReviewId}
					enabled={Boolean(session?.user)}
					onEvent={handleReviewRealtimeEvent}
				/>
			) : null}
			<DetailVaulSheet
				open={isOpen}
				onOpenChange={handleOpenChange}
				title={drawerTitle}
				description="Read a patron review"
				handleLeading={handleLeading}
				handleTrailing={handleTrailing}
			>
				<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
					<DetailDrawerScrollBody scrollRef={scrollRef}>
						<div className="mx-auto w-full max-w-xl pt-2 pb-10">
							{showFilmContextAboveStill && posterUrl ? (
								<div className="mx-auto mb-3 flex justify-center">
									<Link
										href={`/movies/${detail?.movie?.tmdbId}`}
										onClick={handleClose}
										className="relative block aspect-[2/3] w-[7.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg transition-transform duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none"
									>
										<Image
											src={posterUrl}
											alt=""
											fill
											sizes="120px"
											className="object-cover"
											unoptimized
										/>
									</Link>
								</div>
							) : null}

							{showFilmContextAboveStill && movieTitleLine ? (
								<p className="mb-4 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
									<Link
										href={`/movies/${detail?.movie?.tmdbId}`}
										className="text-foreground/90 hover:text-desert-orange"
										onClick={handleClose}
									>
										{movieTitleLine}
									</Link>
								</p>
							) : null}

							{showStillSection ? (
								<ReviewReaderStillSection
									slides={movieScreenshots}
									selectedKey={selectedStillKey}
									isOwner={isReviewOwner}
									saving={savingStill}
									onSelect={(slideKey) => void handleSelectStill(slideKey)}
								/>
							) : loading && !detail ? (
								<Skeleton className="mb-6 aspect-video w-full rounded-[1.5rem] bg-background" />
							) : null}

							{showStandaloneFilmContext && posterUrl ? (
								<div className="mx-auto mb-5 flex justify-center">
									<Link
										href={`/movies/${detail?.movie?.tmdbId}`}
										onClick={handleClose}
										className="relative block aspect-[2/3] w-[7.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg transition-transform duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none"
									>
										<Image
											src={posterUrl}
											alt=""
											fill
											sizes="120px"
											className="object-cover"
											unoptimized
										/>
									</Link>
								</div>
							) : null}

							{showStandaloneFilmContext && movieTitleLine ? (
								<p className="mb-5 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
									<Link
										href={`/movies/${detail?.movie?.tmdbId}`}
										className="text-foreground/90 hover:text-desert-orange"
										onClick={handleClose}
									>
										{movieTitleLine}
									</Link>
								</p>
							) : null}

							{isReviewOwner &&
							review?.visibility &&
							review.visibility !== "public" ? (
								<div className="mb-6 flex justify-center">
									<VisibilityChip visibility={review.visibility} />
								</div>
							) : null}

							{loadError ? (
								<p className="mb-6 rounded-2xl bg-background px-4 py-3 text-center text-muted-foreground text-sm">
									{loadError}
								</p>
							) : null}

							{containsSpoilers && spoilerRevealed ? (
								<p className="mb-5 rounded-2xl bg-desert-orange/10 px-4 py-2.5 text-center text-desert-orange text-sm">
									Contains spoilers
								</p>
							) : null}

							<div className="relative mb-6">
								<ReviewSpoilerGuard
									containsSpoilers={containsSpoilers}
									hasWatchedMovie={hasWatchedMovie}
									isOwnReview={isReviewOwner}
									revealed={spoilerRevealed}
									onReveal={() => setSpoilerRevealed(true)}
								>
									<div className="mx-auto flex w-full max-w-prose flex-col items-center text-center">
										{hasDisplayRating ? (
											<div
												className={
													showStandaloneFilmContext && posterUrl
														? "mt-3"
														: "mt-6"
												}
											>
												<ReviewEditorialPatronScore rating={displayRating} />
											</div>
										) : null}

										{displayTitle ? (
											<h2
												id="review-detail-title"
												className={cn(
													"max-w-prose text-balance px-3 font-semibold font-serif text-foreground text-xl leading-snug tracking-tight sm:px-4 sm:text-2xl",
													hasDisplayRating ? "mt-3" : "mt-6",
												)}
											>
												{displayTitle}
											</h2>
										) : (
											<h2 id="review-detail-title" className="sr-only">
												{drawerTitle}
											</h2>
										)}

										<ReviewVoiceAttachment
											audioUrl={displayAudioUrl}
											audioDurationMs={displayAudioDurationMs}
											className="mt-4"
											stopPropagation
										/>

										{showReviewBody ? (
											<p
												data-review-body=""
												className={cn(
													"w-full max-w-prose whitespace-pre-wrap px-2 py-1 text-center tracking-tight outline-none",
													displayTitle
														? "mt-1.5 text-pretty font-editorial font-normal text-foreground/90 text-xl leading-normal sm:text-2xl"
														: "mt-3 text-pretty font-sans font-semibold text-foreground text-xl leading-normal sm:text-2xl",
												)}
											>
												<ReviewBodyWithMentions body={displayBody} />
											</p>
										) : null}
									</div>
								</ReviewSpoilerGuard>
								{loading && !detail ? (
									<div
										aria-hidden
										className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-transparent via-card/40 to-card"
									/>
								) : null}
							</div>

							<section className="space-y-3" aria-label="Comments">
								<div className="flex w-full items-center justify-center gap-2">
									<p className="text-center text-muted-foreground text-xs tabular-nums">
										{displayComments}{" "}
										{displayComments === 1 ? "comment" : "comments"}
									</p>
									{loading ? (
										<Loader2
											className="size-3.5 animate-spin text-muted-foreground"
											aria-label="Loading review"
										/>
									) : null}
								</div>
								{detail ? (
									<CommentsThread
										key={detail.review.id}
										appearance="sheet"
										targetKind="review"
										targetId={detail.review.id}
										initialComments={threadSeedComments}
										listingContext={
											detail.review.movieId
												? {
														kind: "movie",
														tmdbId: detail.review.movieId,
													}
												: null
										}
										scrollRootRef={scrollRef}
										liveRefreshSignal={liveCommentSignal}
										liveRefreshCommentId={liveCommentId}
										onCommentsChange={handleCommentsChange}
									/>
								) : loading ? (
									<ul className="space-y-3" aria-hidden>
										{[0, 1].map((i) => (
											<li key={i}>
												<Skeleton className="h-16 w-full rounded-2xl bg-background" />
											</li>
										))}
									</ul>
								) : (
									<p className="text-center text-muted-foreground text-sm">
										Comments unavailable.
									</p>
								)}
							</section>
						</div>
					</DetailDrawerScrollBody>

					<SheetScrollScrims
						showHeaderFade={showHeaderFade}
						showFooterFade={showFooterFade}
					/>
				</div>
			</DetailVaulSheet>
			{/* Portaled confirm — sibling of the Vaul sheet so drawer layers cannot steal taps. */}
			<ReviewDeleteConfirmDialog
				open={deleteOpen}
				deleting={deleting}
				onCancel={() => setDeleteOpen(false)}
				onConfirm={() => void handleConfirmDelete()}
			/>
		</>
	);
}
