"use client";

import { cn } from "@still/ui/lib/utils";
import { ListMusic, Quote, Sparkles } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useCallback, useId, useState } from "react";

import { DoubleFeatureSuggestion } from "@/components/cinema/double-feature-suggestion";
import { MoviePoster } from "@/components/movie/movie-poster";
import { StarRating } from "@/components/rating/star-rating";
import { ReviewCard } from "@/components/review/review-card";
import { Section } from "@/components/ui/section";
import { formatDistanceToNowStrict } from "@/lib/format";
import type { TmdbMovieSummary } from "@/lib/movie-detail-tmdb";

type TabId = "reviews" | "lists" | "related";

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
 * include this title), **Related** (TMDb recommendations + double-feature nudge).
 * Keyboard-friendly tablist with roving `aria-selected` per WAI-ARIA tabs pattern.
 */
export function MovieDetailExploreTabs({
	lists,
	featuredReviews,
	reviewsAfterFeatured,
	reviews,
	moreLikeThis,
	doubleFeaturePick,
	currentTitle,
}: {
	lists: MovieListForPageTab[];
	featuredReviews: MoviePageReview[];
	reviewsAfterFeatured: MoviePageReview[];
	reviews: MoviePageReview[];
	moreLikeThis: TmdbMovieSummary[];
	doubleFeaturePick: TmdbMovieSummary | null;
	currentTitle: string;
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

	const hasRelatedBody = moreLikeThis.length > 0 || doubleFeaturePick != null;

	return (
		<Section
			kicker="Programme"
			title="From the community & repertory desk"
			subtitle="Member writing, public lists that include this title, and TMDb-powered adjacencies."
		>
			<div className="mb-6 border-border/80 border-b">
				<div
					role="tablist"
					aria-label="Film detail sections"
					className="flex gap-1 overflow-x-auto pb-px [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
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
								"shrink-0 rounded-t-lg border border-b-0 px-4 py-2.5 font-medium text-sm transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								tab === t.id
									? "border-border bg-surface-raised text-foreground"
									: "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
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
				className={tab === "reviews" ? "space-y-8" : "hidden"}
			>
				{featuredReviews.length ? (
					<div>
						<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Spotlight reviews
						</h3>
						<ul className="mb-8 grid gap-4 md:grid-cols-2">
							{featuredReviews.map((r) => (
								<li
									key={r.id}
									className="relative rounded-2xl border border-border bg-card/40 p-5 pl-6"
								>
									<Quote
										className="absolute top-3 left-3 size-5 text-desert-orange/50"
										aria-hidden
									/>
									<Link href={`/reviews/${r.id}`} className="group block">
										{r.title ? (
											<p className="font-serif text-lg group-hover:text-desert-orange">
												{r.title}
											</p>
										) : null}
										<p className="mt-2 line-clamp-5 font-editorial text-foreground/85 text-sm">
											{r.body}
										</p>
										<div className="mt-3 flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
											<span>Still member · {r.likesCount} likes</span>
											{r.rating ? (
												<StarRating value={r.rating} readOnly size="sm" />
											) : null}
										</div>
									</Link>
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

				{!featuredReviews.length && reviews.length ? (
					<ul className="grid gap-4 md:grid-cols-2">
						{reviews.slice(0, 12).map((r) => (
							<li key={r.id}>
								<ReviewCard review={r} />
							</li>
						))}
					</ul>
				) : null}

				{!featuredReviews.length && !reviews.length ? (
					<p className="text-muted-foreground text-sm">
						No reviews yet. Be the first to write one.
					</p>
				) : null}
			</div>

			<div
				role="tabpanel"
				id={`${tabIds.lists}-panel`}
				aria-labelledby={tabIds.lists}
				hidden={tab !== "lists"}
				className={tab === "lists" ? "space-y-4" : "hidden"}
			>
				{lists.length ? (
					<ul className="grid gap-3 sm:grid-cols-2">
						{lists.map((list) => (
							<li key={list.id}>
								<Link
									href={`/lists/${list.id}`}
									className="flex items-start gap-3 rounded-2xl border border-border bg-card/50 p-4 transition-colors hover:border-desert-orange/40"
								>
									<span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-soft-stone text-desert-orange">
										<ListMusic className="size-5" aria-hidden />
									</span>
									<span className="min-w-0">
										<span className="block font-serif text-foreground text-lg">
											{list.title}
										</span>
										<span className="mt-1 block text-muted-foreground text-xs">
											{list.itemsCount} films · {list.likesCount} likes ·
											updated{" "}
											{formatDistanceToNowStrict(new Date(list.updatedAt))} ago
										</span>
										{list.description ? (
											<span className="mt-2 line-clamp-2 block font-editorial text-foreground/80 text-sm">
												{list.description}
											</span>
										) : null}
									</span>
								</Link>
							</li>
						))}
					</ul>
				) : (
					<div
						className="rounded-2xl border border-border border-dashed bg-surface-raised/40 p-8 text-center"
						role="status"
					>
						<ListMusic
							className="mx-auto size-8 text-muted-foreground/70"
							aria-hidden
						/>
						<p className="mt-3 font-display text-lg">No public lists yet</p>
						<p className="mt-2 text-muted-foreground text-sm">
							No community lists on Still include this title — start a list from
							your profile and add it for others to find here.
						</p>
						<Link
							href="/lists/new"
							className="mt-4 inline-block font-medium text-desert-orange text-sm underline-offset-2 hover:underline"
						>
							Create a list
						</Link>
					</div>
				)}
			</div>

			<div
				role="tabpanel"
				id={`${tabIds.related}-panel`}
				aria-labelledby={tabIds.related}
				hidden={tab !== "related"}
				className={tab === "related" ? "space-y-8" : "hidden"}
			>
				{hasRelatedBody ? (
					<>
						{moreLikeThis.length ? (
							<div>
								<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
									More films like this
								</h3>
								<p className="mb-4 text-muted-foreground text-sm">
									Blended from TMDb recommendations and related titles.
								</p>
								<div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
									{moreLikeThis.map((m) => (
										<MoviePoster
											key={m.id}
											movieId={m.id}
											title={m.title}
											posterUrl={
												m.poster_path
													? `https://image.tmdb.org/t/p/w342${m.poster_path}`
													: null
											}
											showTitle
										/>
									))}
								</div>
							</div>
						) : null}
						{doubleFeaturePick ? (
							<DoubleFeatureSuggestion
								currentTitle={currentTitle}
								pick={doubleFeaturePick}
							/>
						) : null}
					</>
				) : (
					<div
						className="rounded-2xl border border-border border-dashed bg-surface-raised/40 p-8 text-center"
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
