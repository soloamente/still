"use client";

import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";
import { ListMusic, Quote, Sparkles } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useId, useState } from "react";

import { CreateListDialog } from "@/components/list/create-list-dialog";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MoviePoster } from "@/components/movie/movie-poster";
import { ReviewCard } from "@/components/review/review-card";
import { useReviewDetail } from "@/components/review/review-detail-sheet";
import { Section } from "@/components/ui/section";
import { formatDistanceToNowStrict } from "@/lib/format";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import { MOVIE_DETAIL_SECTION } from "@/lib/movie-detail-sections";
import type { TmdbMovieSummary } from "@/lib/movie-detail-tmdb";

type TabId = "reviews" | "lists" | "related";

/** Single-surface community tiles on film detail (`bg-card` section). */
const COMMUNITY_CARD = "rounded-2xl bg-background";

function MovieDetailSubsectionLabel({ children }: { children: ReactNode }) {
	return (
		<p className="mb-4 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
			{children}
		</p>
	);
}

function MovieDetailCommunityStats({
	communityAverage,
	communityReviewsCount,
	reviewsCount,
	listsCount,
}: {
	communityAverage: number | null;
	communityReviewsCount: number;
	reviewsCount: number;
	listsCount: number;
}) {
	const hasAverage = communityAverage != null && communityReviewsCount > 0;

	return (
		<ul className="grid gap-4 sm:grid-cols-3">
			<li className={cn(COMMUNITY_CARD, "px-5 py-7 text-center")}>
				<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
					Still average
				</p>
				{hasAverage ? (
					<>
						<p className="mt-4 font-serif text-4xl text-foreground tabular-nums tracking-tight sm:text-5xl">
							{formatLogRatingDisplay(communityAverage)}
							<span className="text-lg text-muted-foreground sm:text-xl">
								/10
							</span>
						</p>
						<p className="mt-2 text-balance font-editorial text-muted-foreground text-xs leading-relaxed">
							From {communityReviewsCount} published{" "}
							{communityReviewsCount === 1 ? "review" : "reviews"}
						</p>
					</>
				) : (
					<p className="mt-4 font-editorial text-muted-foreground text-sm leading-relaxed">
						No member ratings yet — publish a review to seed the average.
					</p>
				)}
			</li>
			<li
				className={cn(
					COMMUNITY_CARD,
					"flex flex-col justify-center px-5 py-7 text-center",
				)}
			>
				<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
					Reviews
				</p>
				<p className="mt-4 font-serif text-4xl text-foreground tabular-nums tracking-tight">
					{reviewsCount}
				</p>
				<p className="mt-2 font-editorial text-muted-foreground text-xs">
					{reviewsCount === 1 ? "Published write-up" : "Published write-ups"}
				</p>
			</li>
			<li
				className={cn(
					COMMUNITY_CARD,
					"flex flex-col justify-center px-5 py-7 text-center",
				)}
			>
				<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
					Lists
				</p>
				<p className="mt-4 font-serif text-4xl text-foreground tabular-nums tracking-tight">
					{listsCount}
				</p>
				<p className="mt-2 font-editorial text-muted-foreground text-xs">
					{listsCount === 1 ? "Public list" : "Public lists"} featuring this
					title
				</p>
			</li>
		</ul>
	);
}

/** Lists empty state — hero `IconListPlay` + create-list sheet (same as Add to list). */
function MovieDetailListsEmpty({
	movieId,
	movieTitle,
}: {
	movieId?: number;
	movieTitle?: string;
}) {
	const [createOpen, setCreateOpen] = useState(false);

	return (
		<>
			<div
				className={cn(COMMUNITY_CARD, "px-6 py-10 text-center")}
				role="status"
			>
				<span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-background text-foreground">
					<IconListPlay
						size="22px"
						className="shrink-0 opacity-90"
						aria-hidden
					/>
				</span>
				<p className="mt-4 font-sans text-lg">No public lists yet</p>
				<p className="mx-auto mt-2 max-w-sm text-balance font-editorial text-muted-foreground text-sm leading-relaxed">
					No community lists on Still include this title — start a list from
					your profile and add it for others to find here.
				</p>
				<DetailMotionButton
					type="button"
					className={cn(
						// Raised `bg-card` on canvas `COMMUNITY_CARD` — `bg-background` matches the wrapper.
						"mt-6 inline-flex items-center justify-center rounded-full bg-card px-5 py-2.5 font-medium text-foreground text-sm shadow-sm",
						"[@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground",
					)}
					onClick={() => setCreateOpen(true)}
				>
					Create a list
				</DetailMotionButton>
			</div>
			<CreateListDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				movieId={movieId}
				movieTitle={movieTitle}
			/>
		</>
	);
}

/** Related picks — same poster grid chrome as `/home` catalogue lobby. */
function RelatedMoviesPosterGrid({
	movies,
	listingKind = "movie",
}: {
	movies: TmdbMovieSummary[];
	listingKind?: "movie" | "tv";
}) {
	return (
		<div
			className={cn(
				HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
				HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
			)}
		>
			{movies.map((m, index) => (
				<MoviePoster
					key={m.id}
					className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
					frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
					hoverEffect="elevation"
					movieId={m.id}
					title={m.title}
					posterUrl={
						m.poster_path
							? `https://image.tmdb.org/t/p/w342${m.poster_path}`
							: null
					}
					priority={index < 6}
					showTitle={false}
					listingKind={listingKind}
				/>
			))}
		</div>
	);
}

export type MovieListForPageTab = {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	updatedAt: string;
	likesCount: number;
};

export type MoviePageReview = {
	id: string;
	userId: string;
	movieId: number;
	title: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
};

/**
 * Track B.5.3 — dense film-page body: **Reviews**, **Lists** (community lists that
 * include this title), **Related** (TMDb recommendations).
 * Keyboard-friendly tablist with roving `aria-selected` per WAI-ARIA tabs pattern.
 */
export function MovieDetailExploreTabs({
	lists,
	featuredReviews,
	reviewsAfterFeatured,
	reviews,
	moreLikeThis,
	communityAverage = null,
	communityReviewsCount = 0,
	layout = "tabs",
	/** Related grid links to `/tv/[id]` when surfacing TMDb TV adjacencies. */
	relatedListingKind = "movie",
	movieId,
	movieTitle,
}: {
	lists: MovieListForPageTab[];
	featuredReviews: MoviePageReview[];
	reviewsAfterFeatured: MoviePageReview[];
	reviews: MoviePageReview[];
	moreLikeThis: TmdbMovieSummary[];
	communityAverage?: number | null;
	communityReviewsCount?: number;
	/** Stacked sections power the fixed right-rail scroll legend on film detail. */
	layout?: "tabs" | "stacked";
	relatedListingKind?: "movie" | "tv";
	/** Pre-fill create-list sheet and add this title after save. */
	movieId?: number;
	movieTitle?: string;
}) {
	const baseId = useId();
	const [tab, setTab] = useState<TabId>("reviews");
	const openReviewDetail = useReviewDetail((s) => s.open);

	const tabIds = {
		reviews: `${baseId}-reviews`,
		lists: `${baseId}-lists`,
		related: `${baseId}-related`,
	} as const;

	const onKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			const order: TabId[] = ["reviews", "lists", "related"];
			const idx = order.indexOf(tab);
			if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				const nextIdx = (idx + 1) % order.length;
				setTab(order[nextIdx] as TabId);
			}
			if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				const nextIdx = (idx - 1 + order.length) % order.length;
				setTab(order[nextIdx] as TabId);
			}
			if (e.key === "Home") {
				e.preventDefault();
				setTab("reviews");
			}
			if (e.key === "End") {
				e.preventDefault();
				setTab("related");
			}
		},
		[tab],
	);

	const tabs: { id: TabId; label: string }[] = [
		{ id: "reviews", label: "Reviews" },
		{ id: "lists", label: "Lists" },
		{ id: "related", label: "Related" },
	];

	const hasRelatedBody = moreLikeThis.length > 0;

	const communityStatsPanel = (
		<MovieDetailCommunityStats
			communityAverage={communityAverage}
			communityReviewsCount={communityReviewsCount}
			reviewsCount={reviews.length}
			listsCount={lists.length}
		/>
	);

	const reviewsPanel = (
		<>
			{featuredReviews.length ? (
				<div>
					<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Spotlight reviews
					</h3>
					<ul className="mb-8 grid gap-4 md:grid-cols-2">
						{featuredReviews.map((r) => (
							<li
								key={r.id}
								className={cn(COMMUNITY_CARD, "relative p-5 pl-7")}
							>
								<Quote
									className="absolute top-4 left-3 size-5 text-desert-orange/50"
									aria-hidden
								/>
								<button
									type="button"
									className="group block w-full cursor-pointer text-left"
									onClick={() =>
										openReviewDetail({
											reviewId: r.id,
											preview: {
												id: r.id,
												title: r.title,
												body: r.body,
												rating: r.rating,
												likesCount: r.likesCount,
												commentsCount: r.commentsCount,
												publishedAt: r.publishedAt,
											},
										})
									}
								>
									{r.title ? (
										<p className="font-serif text-lg group-hover:text-desert-orange">
											{r.title}
										</p>
									) : null}
									<p className="mt-2 line-clamp-5 font-editorial text-foreground/85 text-sm leading-relaxed">
										{r.body}
									</p>
									<div className="mt-3 flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
										<span>Still member · {r.likesCount} likes</span>
										{r.rating != null ? (
											<span className="font-medium text-foreground tabular-nums">
												{formatLogRatingDisplay(r.rating)}
												<span className="text-muted-foreground">/10</span>
											</span>
										) : null}
									</div>
								</button>
							</li>
						))}
					</ul>
				</div>
			) : null}

			{reviewsAfterFeatured.length ? (
				<div>
					<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						All member reviews
					</h3>
					<ul className="grid gap-4 md:grid-cols-2">
						{reviewsAfterFeatured.slice(0, 12).map((r) => (
							<li key={r.id}>
								<ReviewCard review={r} />
							</li>
						))}
					</ul>
				</div>
			) : null}

			{!reviews.length ? (
				<p className="text-center text-muted-foreground text-sm">
					No reviews yet. Be the first to write one.
				</p>
			) : null}
		</>
	);

	const listsPanel = lists.length ? (
		<ul className="grid gap-4 sm:grid-cols-2">
			{lists.map((list) => (
				<li key={list.id}>
					<Link
						href={`/lists/${list.id}`}
						className={cn(COMMUNITY_CARD, "flex items-start gap-3 p-4")}
					>
						<span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/30 text-desert-orange">
							<ListMusic className="size-5" aria-hidden />
						</span>
						<span className="min-w-0">
							<span className="block font-serif text-foreground text-lg leading-snug">
								{list.title}
							</span>
							<span className="mt-1 block text-muted-foreground text-xs tabular-nums">
								{list.itemsCount} films · {list.likesCount} likes · updated{" "}
								{formatDistanceToNowStrict(new Date(list.updatedAt))} ago
							</span>
							{list.description ? (
								<span className="mt-2 line-clamp-2 block font-editorial text-foreground/80 text-sm leading-relaxed">
									{list.description}
								</span>
							) : null}
						</span>
					</Link>
				</li>
			))}
		</ul>
	) : (
		<MovieDetailListsEmpty movieId={movieId} movieTitle={movieTitle} />
	);

	const communityPanel = (
		<div className="space-y-14">
			{communityStatsPanel}
			<div>
				<MovieDetailSubsectionLabel>Reviews</MovieDetailSubsectionLabel>
				{reviewsPanel}
			</div>
			<div id={MOVIE_DETAIL_SECTION.lists}>
				<MovieDetailSubsectionLabel>Lists</MovieDetailSubsectionLabel>
				{listsPanel}
			</div>
		</div>
	);

	const relatedPanel = hasRelatedBody ? (
		<RelatedMoviesPosterGrid
			movies={moreLikeThis}
			listingKind={relatedListingKind}
		/>
	) : (
		<div className="rounded-2xl bg-muted/25 p-8 text-center" role="status">
			<Sparkles
				className="mx-auto size-8 text-muted-foreground/70"
				aria-hidden
			/>
			<p className="mt-3 font-display text-lg">No related picks from TMDb</p>
			<p className="mt-2 text-muted-foreground text-sm">
				This title doesn’t have recommendation/similar rows cached yet — check
				back after the next catalogue sync.
			</p>
		</div>
	);

	if (layout === "stacked") {
		return (
			<>
				<MovieDetailBodySection
					id={MOVIE_DETAIL_SECTION.reviews}
					title="Community"
					subtitle="Still member scores, published reviews, and public lists for this title."
					className="pt-2 pb-2"
				>
					{communityPanel}
				</MovieDetailBodySection>

				<MovieDetailBodySection
					id={MOVIE_DETAIL_SECTION.related}
					title="Related"
					subtitle="TMDb recommendations and similar titles."
					className="pt-2 pb-2"
				>
					{relatedPanel}
				</MovieDetailBodySection>
			</>
		);
	}

	return (
		<Section
			kicker="Programme"
			title="From the community & repertory desk"
			subtitle="Member writing, public lists that include this title, and TMDb-powered adjacencies."
		>
			<div className="mb-6">
				<div
					role="tablist"
					aria-label="Film detail sections"
					className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted/30 p-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
					onKeyDown={onKeyDown}
				>
					{tabs.map((t) => (
						<button
							key={t.id}
							type="button"
							role="tab"
							id={tabIds[t.id]}
							aria-selected={tab === t.id}
							aria-controls={`${tabIds[t.id]}-panel`}
							tabIndex={tab === t.id ? 0 : -1}
							className={cn(
								"shrink-0 rounded-full px-4 py-2.5 font-medium text-sm transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								tab === t.id
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground [@media(hover:hover)]:hover:bg-muted/45 [@media(hover:hover)]:hover:text-foreground",
							)}
							onClick={() => setTab(t.id)}
						>
							{t.label}
							{t.id === "lists" && lists.length ? (
								<span className="ml-1.5 text-xs tabular-nums opacity-70">
									({lists.length})
								</span>
							) : null}
						</button>
					))}
				</div>
			</div>

			<div
				role="tabpanel"
				id={`${tabIds.reviews}-panel`}
				aria-labelledby={tabIds.reviews}
				hidden={tab !== "reviews"}
				className={tab === "reviews" ? "space-y-10" : "hidden"}
			>
				{communityStatsPanel}
				{reviewsPanel}
			</div>

			<div
				role="tabpanel"
				id={`${tabIds.lists}-panel`}
				aria-labelledby={tabIds.lists}
				hidden={tab !== "lists"}
				className={tab === "lists" ? undefined : "hidden"}
			>
				{listsPanel}
			</div>

			<div
				role="tabpanel"
				id={`${tabIds.related}-panel`}
				aria-labelledby={tabIds.related}
				hidden={tab !== "related"}
				className={tab === "related" ? "space-y-8" : "hidden"}
			>
				{hasRelatedBody ? (
					<RelatedMoviesPosterGrid
						movies={moreLikeThis}
						listingKind={relatedListingKind}
					/>
				) : (
					<div
						className="rounded-2xl bg-muted/25 p-8 text-center"
						role="status"
					>
						<Sparkles
							className="mx-auto size-8 text-muted-foreground/70"
							aria-hidden
						/>
						<p className="mt-3 font-display text-lg">
							No related picks from TMDb
						</p>
						<p className="mt-2 text-muted-foreground text-sm">
							This title doesn’t have recommendation/similar rows cached yet —
							check back after the next catalogue sync.
						</p>
					</div>
				)}
			</div>
		</Section>
	);
}
