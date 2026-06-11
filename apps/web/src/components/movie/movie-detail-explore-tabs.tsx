"use client";

import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";
import { LayoutGrid, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useId, useState } from "react";
import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { CreateListDialog } from "@/components/list/create-list-dialog";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import {
	type MovieDetailFollowingRating,
	MovieDetailFollowingRatings,
} from "@/components/movie/movie-detail-following-ratings";
import { MovieDetailReviewsCarousel } from "@/components/movie/movie-detail-reviews-carousel";
import { Section } from "@/components/ui/section";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { formatDistanceToNowStrict } from "@/lib/format";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	isListCoverProxySrc,
	listBoardRowPosterUrl,
} from "@/lib/list-cover-image";
import { MOVIE_DETAIL_SECTION } from "@/lib/movie-detail-sections";
import type { TmdbMovieSummary } from "@/lib/movie-detail-tmdb";
import { requestCreateList } from "@/lib/open-create-list-surface";

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

/** Subsection kicker — count + correct review/reviews (uppercase via label styles). */
function formatReviewsSubsectionLabel(count: number) {
	return (
		<>
			<span className="tabular-nums">{count}</span>{" "}
			{count === 1 ? "review" : "reviews"}
		</>
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
					No public lists include this title yet — start a list from your
					profile and add it for others to find here.
				</p>
				<DetailMotionButton
					type="button"
					className={cn(
						// Raised `bg-card` on canvas `COMMUNITY_CARD` — `bg-background` matches the wrapper.
						"mt-6 inline-flex items-center justify-center rounded-full bg-card px-5 py-2.5 font-medium text-foreground text-sm shadow-sm",
						"[@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground",
					)}
					onClick={() =>
						requestCreateList({ movieId, movieTitle }, () =>
							setCreateOpen(true),
						)
					}
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

/** Related picks — same poster grid + radial toolkit as `/home` catalogue lobby. */
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
				<CataloguePosterTile
					key={m.id}
					className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
					frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
					hoverEffect="elevation"
					listingKind={listingKind}
					posterUrl={
						m.poster_path
							? `https://image.tmdb.org/t/p/w342${m.poster_path}`
							: null
					}
					priority={index < 6}
					surface="home"
					title={m.title}
					tmdbId={m.id}
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
	ownerHandle?: string;
	coverMovieIds?: number[];
	coverPosterPaths?: (string | null)[];
	coverImageUrl?: string | null;
	coverMovieId?: number | null;
};

export type MoviePageReviewAuthor = {
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
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
	containsSpoilers: boolean;
	author?: MoviePageReviewAuthor | null;
};

/**
 * Track B.5.3 — dense film-page body: **Reviews**, **Lists** (community lists that
 * include this title), **Related** (TMDb recommendations).
 * Keyboard-friendly tablist with roving `aria-selected` per WAI-ARIA tabs pattern.
 */
export function MovieDetailExploreTabs({
	lists,
	reviews,
	moreLikeThis,
	followingRatings = [],
	followingRatingsMoreCount = 0,
	layout = "tabs",
	/** Related grid links to `/tv/[id]` when surfacing TMDb TV adjacencies. */
	relatedListingKind = "movie",
	movieId,
	movieTitle,
	listingTmdbId: _listingTmdbId,
	listCountLabel = "films",
}: {
	lists: MovieListForPageTab[];
	reviews: MoviePageReview[];
	moreLikeThis: TmdbMovieSummary[];
	/** Latest diary scores from patrons the viewer follows (signed-in only). */
	followingRatings?: MovieDetailFollowingRating[];
	followingRatingsMoreCount?: number;
	/** Stacked sections power the fixed right-rail scroll legend on film detail. */
	layout?: "tabs" | "stacked";
	relatedListingKind?: "movie" | "tv";
	/** Pre-fill create-list sheet and add this title after save. */
	movieId?: number;
	movieTitle?: string;
	listingTmdbId: number;
	/** Meta line after list owner — `films` on movie detail, `titles` on TV. */
	listCountLabel?: string;
}) {
	const baseId = useId();
	const [tab, setTab] = useState<TabId>("reviews");

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

	const reviewsSubsectionLabel = formatReviewsSubsectionLabel(reviews.length);

	const reviewsPanel = (
		<MovieDetailReviewsCarousel movieId={movieId} reviews={reviews} />
	);

	const listsPanel = lists.length ? (
		<ul className="grid gap-4 sm:grid-cols-2">
			{lists.map((list) => {
				const coverSrc = listBoardRowPosterUrl(
					{
						id: list.id,
						coverImageUrl: list.coverImageUrl,
						coverPosterPaths: list.coverPosterPaths ?? [],
						updatedAt: list.updatedAt,
					},
					"w342",
				);
				return (
					<li key={list.id} className={cn(COMMUNITY_CARD, "overflow-hidden")}>
						<Link
							href={`/lists/${list.id}`}
							className="flex items-stretch gap-4 p-4 text-left transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100"
						>
							<aside
								className="relative w-[5.25rem] shrink-0 self-stretch sm:w-[6.5rem]"
								aria-hidden
							>
								<div className="relative size-full min-h-[9.5rem] overflow-hidden rounded-2xl bg-muted/30">
									{coverSrc ? (
										<Image
											src={coverSrc}
											alt=""
											fill
											sizes="(max-width: 640px) 88px, 104px"
											className="object-cover"
											unoptimized={isListCoverProxySrc(coverSrc)}
										/>
									) : (
										<div className="grid size-full place-items-center text-desert-orange">
											<LayoutGrid className="size-6" aria-hidden />
										</div>
									)}
								</div>
							</aside>
							<div className="min-w-0 flex-1">
								<p className="font-serif text-foreground text-lg leading-snug [@media(hover:hover)]:hover:text-desert-orange">
									{list.title}
								</p>
								<p className="mt-1 text-muted-foreground text-xs tabular-nums">
									{list.ownerHandle ? (
										<>
											by{" "}
											<span className="text-foreground/85">
												@{list.ownerHandle}
											</span>
											{" · "}
										</>
									) : null}
									{list.itemsCount} {listCountLabel} · {list.likesCount}{" "}
									{list.likesCount === 1 ? "like" : "likes"} · updated{" "}
									{formatDistanceToNowStrict(new Date(list.updatedAt))} ago
								</p>
								{list.description ? (
									<p className="mt-2 line-clamp-2 font-editorial text-foreground/80 text-sm leading-relaxed">
										{list.description}
									</p>
								) : null}
							</div>
						</Link>
					</li>
				);
			})}
		</ul>
	) : (
		<MovieDetailListsEmpty movieId={movieId} movieTitle={movieTitle} />
	);

	const followingRatingsPanel =
		followingRatings.length > 0 ? (
			<MovieDetailFollowingRatings
				entries={followingRatings}
				moreCount={followingRatingsMoreCount}
			/>
		) : null;

	const communityPanel = (
		<div className="space-y-14">
			{followingRatingsPanel}
			<div>
				<MovieDetailSubsectionLabel>
					{reviewsSubsectionLabel}
				</MovieDetailSubsectionLabel>
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
					subtitle="Reviews, lists, and patron scores for this title."
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
			subtitle="Reviews, public lists that include this title, and TMDb-powered adjacencies."
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
							{t.id === "reviews" && reviews.length > 0 ? (
								<span className="ml-1.5 text-xs tabular-nums opacity-70">
									({reviews.length})
								</span>
							) : null}
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
				{followingRatingsPanel}
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
