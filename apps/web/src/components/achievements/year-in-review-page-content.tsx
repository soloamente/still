"use client";

import IconShareIn from "@still/ui/icons/share-in";
import IconShareOut from "@still/ui/icons/share-out";
import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import Image from "next/image";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { YearInReviewViewTracker } from "@/components/achievements/year-in-review-view-tracker";
import { DetailMotionLink } from "@/components/movie/detail-motion-pressable";
import { MoviePoster } from "@/components/movie/movie-poster";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import {
	formatYearInReviewAverageRating,
	formatYearInReviewBusiestMonth,
	formatYearInReviewDecade,
} from "@/lib/year-in-review-display";
import {
	ogYearInReviewPath,
	yearInReviewSharePath,
} from "@/lib/year-in-review-share";
import type { YearInReviewPayload } from "@/lib/year-in-review-types";

const actionPillClassName = cn(
	"inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-card px-4 py-2 font-semibold text-foreground text-sm transition-[transform,colors] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-muted/35",
);

function StatTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl bg-background px-4 py-3 text-center">
			<p className="text-[11px] text-muted-foreground">{label}</p>
			<p className="font-semibold text-foreground text-lg tabular-nums tracking-tight">
				{value}
			</p>
		</div>
	);
}

/**
 * Signed-in Wrapped page body — stats, top titles, share row.
 */
export function YearInReviewPageContent({
	payload,
	handle,
	displayName,
}: {
	payload: YearInReviewPayload;
	handle: string;
	displayName: string;
}) {
	const reduceMotion = useReducedMotion();
	const [shareCopied, setShareCopied] = useState(false);
	const shareCheckRef = useRef<HTMLSpanElement>(null);
	const { year, eligible } = payload;

	const shareUrl =
		typeof window !== "undefined"
			? `${window.location.origin}${yearInReviewSharePath(handle, year)}`
			: yearInReviewSharePath(handle, year);

	const ogUrl =
		typeof window !== "undefined"
			? `${window.location.origin}${ogYearInReviewPath(handle, year)}`
			: ogYearInReviewPath(handle, year);

	const trackShared = useCallback(
		(method: "copy" | "download") => {
			trackSenseProductEvent("wrapped.shared", { year, method });
		},
		[year],
	);

	const handleCopyLink = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setShareCopied(true);
			toast.success("Link copied");
			trackShared("copy");
			window.setTimeout(() => setShareCopied(false), 1600);
		} catch {
			toast.error("Couldn't copy link");
		}
	}, [shareUrl, trackShared]);

	useLayoutEffect(() => {
		if (!shareCopied || reduceMotion) return;
		const check = shareCheckRef.current;
		if (!check) return;
		check.setAttribute("data-state", "out");
		void check.offsetWidth;
		check.setAttribute("data-state", "in");
	}, [shareCopied, reduceMotion]);

	const handleDownloadOg = useCallback(() => {
		trackShared("download");
		window.open(ogUrl, "_blank", "noopener,noreferrer");
	}, [ogUrl, trackShared]);

	const avgLabel = formatYearInReviewAverageRating(payload.averageRating);
	const busiestLabel = formatYearInReviewBusiestMonth(payload.busiestMonth);
	const decadeLabel = formatYearInReviewDecade(payload.topDecade);

	return (
		<>
			<YearInReviewViewTracker year={year} />
			<div className="flex flex-1 flex-col overflow-visible bg-background">
				<header className="sticky top-0 z-30 w-full overflow-visible bg-background">
					<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 sm:px-3">
						<div className="flex min-w-0 justify-start">
							<DetailMotionLink
								href="/home"
								className={cn(
									actionPillClassName,
									"max-w-full pl-3 font-medium",
								)}
							>
								<IconShareIn size="20px" className="shrink-0 opacity-90" />
								<span className="truncate">Home</span>
							</DetailMotionLink>
						</div>
						<p className="max-w-[min(100%,12rem)] truncate text-center font-medium text-foreground text-sm sm:max-w-xs">
							{year} in film
						</p>
						<div className="min-w-0" aria-hidden />
					</div>
				</header>

				<section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
					<header className="space-y-2 text-center">
						<p className="font-medium text-foreground/80 text-xs tracking-wide">
							@{handle}
						</p>
						<h1 className="text-balance font-medium font-sans text-foreground text-xl tracking-tight sm:text-2xl">
							{displayName}&apos;s {year}
						</h1>
						<p className="mx-auto max-w-md text-balance text-muted-foreground text-sm leading-relaxed">
							{eligible
								? "Your diary year at a glance — share the card when you are ready."
								: "Log at least five titles this year to unlock your Wrapped."}
						</p>
					</header>

					{eligible ? (
						<>
							<div className="rounded-[1.75rem] bg-card p-4 sm:p-5">
								<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
									<StatTile
										label="Diary logs"
										value={String(payload.totalLogs)}
									/>
									{avgLabel ? (
										<StatTile label="Average rating" value={avgLabel} />
									) : null}
									<StatTile
										label="Reviews"
										value={String(payload.reviewCount)}
									/>
									{payload.longestStreakInYear > 0 ? (
										<StatTile
											label="Longest streak"
											value={`${payload.longestStreakInYear} day${payload.longestStreakInYear === 1 ? "" : "s"}`}
										/>
									) : null}
									{busiestLabel ? (
										<StatTile label="Busiest month" value={busiestLabel} />
									) : null}
									{decadeLabel ? (
										<StatTile label="Top decade" value={decadeLabel} />
									) : null}
								</dl>

								{payload.topGenres.length > 0 ? (
									<div className="mt-4 flex flex-wrap justify-center gap-2 border-border/40 border-t pt-4">
										{payload.topGenres.map((genre) => (
											<span
												key={genre.genreId}
												className="rounded-full bg-background px-3 py-1.5 font-medium text-foreground text-xs"
											>
												{genre.label}
												<span className="ml-1.5 text-muted-foreground tabular-nums">
													{genre.count}
												</span>
											</span>
										))}
									</div>
								) : null}
							</div>

							{payload.topTitles.length > 0 ? (
								<div className="space-y-3">
									<h2 className="text-center font-medium text-foreground text-sm">
										Top picks
									</h2>
									<div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
										{payload.topTitles.map((title, index) => {
											const posterUrl = tmdbPosterUrlFromPath(
												title.posterPath,
												"w342",
											);
											return (
												<MoviePoster
													key={`${title.kind}:${title.tmdbId}`}
													className="min-w-0"
													frameClassName="rounded-2xl border-0"
													hoverEffect="elevation"
													listingKind={title.kind}
													movieId={title.tmdbId}
													posterCaption={
														title.rating != null
															? formatYearInReviewAverageRating(title.rating)
															: null
													}
													posterUrl={posterUrl}
													priority={index < 3}
													showTitle={false}
													title={title.title}
												/>
											);
										})}
									</div>
								</div>
							) : null}

							<div className="flex flex-wrap items-center justify-center gap-2">
								<button
									type="button"
									className={actionPillClassName}
									onClick={() => void handleCopyLink()}
								>
									{shareCopied ? (
										<span
											ref={shareCheckRef}
											className="t-success-check size-4 shrink-0"
											data-state={reduceMotion ? "in" : "out"}
											aria-hidden
										>
											<svg
												viewBox="0 0 24 24"
												className="size-4"
												fill="none"
												stroke="currentColor"
												strokeWidth="2.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												aria-hidden
											>
												<title>Copied</title>
												<path d="M5 13l4 4L19 7" />
											</svg>
										</span>
									) : (
										<IconShareOut
											className="size-4 shrink-0 opacity-90"
											aria-hidden
										/>
									)}
									{shareCopied ? "Copied" : "Copy link"}
								</button>
								<button
									type="button"
									className={actionPillClassName}
									onClick={handleDownloadOg}
								>
									Download card
								</button>
							</div>

							{!reduceMotion ? (
								<div className="overflow-hidden rounded-[1.75rem] bg-card">
									<div className="relative aspect-1200/630 w-full">
										<Image
											src={ogYearInReviewPath(handle, year)}
											alt={`${year} in film share preview`}
											fill
											unoptimized
											className="object-cover"
											sizes="(max-width: 768px) 100vw, 672px"
										/>
									</div>
								</div>
							) : null}
						</>
					) : (
						<div className="rounded-[1.75rem] bg-card px-6 py-10 text-center">
							<p className="font-medium text-foreground text-sm tabular-nums">
								{payload.totalLogs} of 5 logs logged
							</p>
							<p className="mt-2 text-muted-foreground text-sm">
								Keep logging in your diary — Wrapped unlocks automatically.
							</p>
							<DetailMotionLink
								href="/diary"
								className={cn(actionPillClassName, "mt-5 inline-flex")}
							>
								Go to diary
							</DetailMotionLink>
						</div>
					)}
				</section>
			</div>
		</>
	);
}
