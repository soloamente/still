"use client";

import { Button } from "@still/ui/components/button";
import { Skeleton } from "@still/ui/components/skeleton";
import { cn } from "@still/ui/lib/utils";
import { Loader2, MessageCircle, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { useReviewComposer } from "@/components/review/review-composer";
import { ReviewDeleteConfirmDialog } from "@/components/review/review-delete-confirm-dialog";
import { ReviewPinToProfileButton } from "@/components/review/review-pin-to-profile-button";
import { VisibilityChip } from "@/components/review/visibility-chip";
import { CommentsThread } from "@/components/social/comments-thread";
import { ReactionsBar } from "@/components/social/reactions-bar";
import { api } from "@/lib/api";
import { APP_MEMBER_LABEL } from "@/lib/app-brand";
import { authClient } from "@/lib/auth-client";
import { formatDistanceToNowStrict } from "@/lib/format";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";
import { SHEET_PRIMARY_PILL_CLASS } from "@/lib/sheet-chrome";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/** Card / list preview fields — shown instantly while the sheet loads full detail. */
export type ReviewPreview = {
	id: string;
	title: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
};

type OpenArgs = {
	reviewId: string;
	preview: ReviewPreview;
};

type Store = {
	isOpen: boolean;
	args: OpenArgs | null;
	open: (args: OpenArgs) => void;
	close: () => void;
};

export const useReviewDetail = create<Store>((set) => ({
	isOpen: false,
	args: null,
	open: (args) => set({ isOpen: true, args }),
	close: () => set({ isOpen: false, args: null }),
}));

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
		commentsCount: number;
		containsSpoilers: boolean;
		publishedAt: string;
		visibility?: "public" | "followers" | "friends" | "private";
	};
	movie: {
		tmdbId: number;
		title: string;
		posterPath: string | null;
		year: number | null;
	} | null;
	authorProfile: { displayName: string; handle: string | null } | null;
	liked: boolean;
};

type CommentRow = {
	comment: {
		id: string;
		userId: string;
		body: string;
		createdAt: string;
		replyToId: string | null;
	};
	user: { name: string; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
};

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;

function posterSrcFromPath(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w342${fragment}`;
}

function authorLine(profile: ReviewDetailPayload["authorProfile"]): string {
	const handle = profile?.handle?.trim();
	if (handle) return `@${handle}`;
	const display = profile?.displayName?.trim();
	if (display) return display;
	return APP_MEMBER_LABEL;
}

/**
 * Bottom review reader — mirrors `ReviewComposerRoot` shell, motion, and footer chrome.
 * Open via `useReviewDetail().open({ reviewId, preview })`.
 */
export function ReviewDetailRoot() {
	const pathname = usePathname();
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const { isOpen, args, close } = useReviewDetail();
	const openComposer = useReviewComposer((s) => s.open);
	const { data: session } = authClient.useSession();
	const [detail, setDetail] = useState<ReviewDetailPayload | null>(null);
	const [comments, setComments] = useState<CommentRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const reviewScrollKey = `${detail?.review.id ?? ""}-${comments.length}-${loading}-${loadError ?? ""}`;
	const { showFooterFade } = useSheetScrollFades(
		scrollRef,
		isOpen,
		reviewScrollKey,
	);

	const handleClose = useCallback(() => {
		close();
	}, [close]);

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
		});
		handleClose();
	}, [detail, openComposer, handleClose]);

	const handleConfirmDelete = useCallback(async () => {
		if (!detail?.review) return;
		setDeleting(true);
		try {
			await api.api.reviews({ id: detail.review.id }).delete();
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
	}, [detail, handleClose, router]);

	useEffect(() => {
		if (!isOpen) {
			setDetail(null);
			setComments([]);
			setLoading(false);
			setLoadError(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !args) return;
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
				const payload = reviewRes.data as ReviewDetailPayload | null;
				if (!payload?.review) {
					setLoadError("This review is no longer available.");
					return;
				}
				setDetail(payload);
				setComments((commentsRes.data as CommentRow[] | null) ?? []);
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

	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isOpen, handleClose]);

	const preview = args?.preview;
	const review = detail?.review ?? null;
	const isReviewOwner = Boolean(
		session?.user?.id && review?.userId && session.user.id === review.userId,
	);
	const displayTitle = review?.title ?? preview?.title ?? null;
	const displayBody = review?.body ?? preview?.body ?? "";
	const displayRating = review?.rating ?? preview?.rating ?? null;
	const displayLikes = review?.likesCount ?? preview?.likesCount ?? 0;
	const displayComments = review?.commentsCount ?? preview?.commentsCount ?? 0;
	const displayPublishedAt =
		review?.publishedAt ?? preview?.publishedAt ?? new Date().toISOString();
	const displayLiked = detail?.liked ?? false;
	const showMovieContext =
		Boolean(detail?.movie) && pathname !== `/movies/${detail?.movie?.tmdbId}`;
	const posterUrl = posterSrcFromPath(detail?.movie?.posterPath);
	const movieTitleLine = detail?.movie
		? `${detail.movie.title}${detail.movie.year ? ` (${detail.movie.year})` : ""}`
		: null;

	const dialogLayoutTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.32, ease: SHEET_EASE };

	if (!args || !preview) return null;

	return (
		<AnimatePresence>
			{isOpen ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					className="fixed inset-0 z-50 grid place-items-end bg-absolute-black/82 backdrop-blur-sm md:place-items-center"
					onClick={handleClose}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby="review-detail-title"
						layout
						layoutRoot
						initial={{ y: 32, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={{ y: 16, opacity: 0, scale: 0.98 }}
						transition={{
							duration: 0.18,
							ease: SHEET_EASE,
							layout: dialogLayoutTransition,
						}}
						onClick={(e) => e.stopPropagation()}
						className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10"
					>
						<div className="mb-4 flex justify-end">
							<Button
								variant="ghost"
								size="icon-pill"
								onClick={handleClose}
								aria-label="Close"
								className="text-muted-foreground"
							>
								<X className="size-4" />
							</Button>
						</div>

						<div className="relative min-h-0 flex-1">
							<div
								ref={scrollRef}
								className="max-h-[min(calc(92svh-11rem),640px)] overflow-y-auto overscroll-contain pb-24 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							>
								<motion.div
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.18, ease: SHEET_EASE }}
								>
									{showMovieContext && posterUrl ? (
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

									{displayTitle ? (
										<h2
											id="review-detail-title"
											className="mb-2 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
										>
											{displayTitle}
										</h2>
									) : (
										<h2
											id="review-detail-title"
											className="mb-2 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
										>
											Member review
										</h2>
									)}

									{showMovieContext && movieTitleLine ? (
										<p className="mb-2 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
											<Link
												href={`/movies/${detail?.movie?.tmdbId}`}
												className="text-foreground/90 hover:text-desert-orange"
												onClick={handleClose}
											>
												{movieTitleLine}
											</Link>
										</p>
									) : null}

									<p
										className={
											isReviewOwner &&
											review?.visibility &&
											review.visibility !== "public"
												? "mb-2 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base"
												: "mb-6 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base"
										}
									>
										{detail
											? authorLine(detail.authorProfile)
											: APP_MEMBER_LABEL}
										{" · "}
										{formatDistanceToNowStrict(new Date(displayPublishedAt))}{" "}
										ago
									</p>
									{isReviewOwner &&
									review?.visibility &&
									review.visibility !== "public" ? (
										<div className="mb-6 flex justify-center">
											<VisibilityChip visibility={review.visibility} />
										</div>
									) : null}

									{displayRating != null &&
									formatStoredLogRatingDisplay(displayRating) != null ? (
										<p className="mb-6 text-center font-medium text-2xl text-foreground tabular-nums">
											{formatStoredLogRatingDisplay(displayRating)}
											<span className="text-base text-muted-foreground">
												/10
											</span>
										</p>
									) : null}

									{loadError ? (
										<p className="mb-6 rounded-2xl bg-background px-4 py-3 text-center text-muted-foreground text-sm">
											{loadError}
										</p>
									) : null}

									{review?.containsSpoilers ? (
										<p className="mb-5 rounded-2xl bg-desert-orange/10 px-4 py-2.5 text-center text-desert-orange text-sm">
											Contains spoilers
										</p>
									) : null}

									<div className="relative mb-6">
										<p className="mx-auto max-w-prose whitespace-pre-wrap text-left font-editorial text-foreground/90 text-sm leading-relaxed sm:text-base">
											{displayBody}
										</p>
										{loading && !detail ? (
											<div
												aria-hidden
												className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-transparent via-card/40 to-card"
											/>
										) : null}
									</div>

									<div className="mb-8 flex flex-col items-center gap-2">
										{detail ? (
											<ReactionsBar
												appearance="sheet"
												targetKind="review"
												targetId={detail.review.id}
												initialLikes={displayLikes}
												initialLiked={displayLiked}
											/>
										) : (
											<span className="text-muted-foreground text-sm tabular-nums">
												{displayLikes} {displayLikes === 1 ? "like" : "likes"}
											</span>
										)}
										<p className="inline-flex items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
											<MessageCircle
												className="size-3.5 opacity-70"
												aria-hidden
											/>
											{displayComments}{" "}
											{displayComments === 1 ? "comment" : "comments"}
										</p>
										{loading ? (
											<Loader2
												className="size-4 animate-spin text-muted-foreground"
												aria-label="Loading review"
											/>
										) : null}
									</div>

									<section className="space-y-3" aria-label="Comments">
										<p className="w-full text-center text-muted-foreground text-xs">
											Comments
										</p>
										{detail ? (
											<CommentsThread
												appearance="sheet"
												targetKind="review"
												targetId={detail.review.id}
												initialComments={comments}
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
								</motion.div>
							</div>

							<div
								aria-hidden
								className={cn(
									"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-linear-to-t from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
									showFooterFade ? "opacity-100" : "opacity-0",
								)}
							/>
						</div>

						<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
							{isReviewOwner && review ? (
								<Button
									type="button"
									variant="ghost"
									size="pill"
									className="h-auto min-h-10 px-3 font-medium text-destructive"
									onClick={() => setDeleteOpen(true)}
								>
									Delete
								</Button>
							) : (
								<span aria-hidden className="min-w-0 shrink" />
							)}
							<div className="flex items-center gap-3">
								{review ? (
									<ReviewPinToProfileButton
										reviewId={review.id}
										reviewUserId={review.userId}
									/>
								) : null}
								{isReviewOwner && review ? (
									<DetailMotionButtonWrap>
										<Button
											type="button"
											variant="secondary"
											size="pill"
											className="h-auto min-h-10 bg-background px-5 py-2.5"
											onClick={handleEdit}
										>
											Edit
										</Button>
									</DetailMotionButtonWrap>
								) : null}
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										className={SHEET_PRIMARY_PILL_CLASS}
										onClick={handleClose}
									>
										Done
									</Button>
								</DetailMotionButtonWrap>
							</div>
						</footer>
						<ReviewDeleteConfirmDialog
							open={deleteOpen}
							deleting={deleting}
							onCancel={() => setDeleteOpen(false)}
							onConfirm={() => void handleConfirmDelete()}
						/>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
