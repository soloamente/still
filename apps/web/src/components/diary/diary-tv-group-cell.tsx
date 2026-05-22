"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { DiaryLogRatingLabel } from "@/components/diary/diary-log-rating-label";
import { TvLogScopeChip } from "@/components/diary/tv-log-scope-chip";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { MoviePoster } from "@/components/movie/movie-poster";
import { pickPrimaryTvScopeLabel } from "@/lib/diary-lobby-grouping";
import { diaryLogToQuickLogOpenPayload } from "@/lib/diary-open-log";
import { formatDate } from "@/lib/format";
import {
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

/** Horizontal inset so list/footer clear `rounded-[3rem]` poster corners. */
const DIARY_TV_FLIP_INSET_X = "px-4 sm:px-5";

/** Flip-back footer — primary = canvas foreground; secondary = raised card surface. */
const DIARY_FLIP_BTN_BASE =
	"inline-flex h-10 w-full items-center justify-center rounded-full px-7 font-semibold text-sm transition-[transform,background-color,color] duration-200 ease-out motion-reduce:transition-none active:scale-[0.98] motion-reduce:active:scale-100";
const DIARY_FLIP_BTN_PRIMARY = cn(
	DIARY_FLIP_BTN_BASE,
	"bg-foreground text-background [@media(hover:hover)]:hover:bg-foreground/90",
);
const DIARY_FLIP_BTN_SECONDARY = cn(
	DIARY_FLIP_BTN_BASE,
	"bg-card text-foreground [@media(hover:hover)]:hover:bg-card/80",
);

function tmdbPosterUrl(posterPath: string | null): string | null {
	if (!posterPath?.length) return null;
	if (posterPath.startsWith("http")) return posterPath;
	const fragment = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

/**
 * One diary grid cell for a TV series — tap flips a two-face card (poster front, log list back).
 */
export function DiaryTvGroupCell({
	tmdbId,
	title,
	posterPath,
	logs,
	expanded,
	onToggleExpand,
	priority = false,
}: {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	logs: DiaryLogRow[];
	/** `true` when the card is flipped to the log-list face. */
	expanded: boolean;
	onToggleExpand: () => void;
	priority?: boolean;
}) {
	const router = useRouter();
	const openQuickLog = useQuickLog((s) => s.open);
	const reduceMotion = useReducedMotion();
	const primaryLabel = pickPrimaryTvScopeLabel(logs);
	const entryCountLine =
		logs.length > 1 ? `${logs.length} diary entries` : null;

	const refresh = () => router.refresh();

	/** Flip to poster when patron taps non-interactive back-face space (header, list gutters). */
	const handleBackFaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement;
		if (target.closest("button, a")) return;
		onToggleExpand();
	};

	return (
		<div className="w-full min-w-0" data-diary-group>
			{/* Fixed 2∶3 footprint — flip stays in-grid (no row-span). */}
			<div
				className={cn(
					HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
					"perspective-[1000px] relative aspect-2/3 w-full",
				)}
			>
				<div
					className={cn(
						"transform-3d relative size-full transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
						reduceMotion ? "duration-0" : "duration-500",
						expanded
							? "transform-[rotateY(180deg)]"
							: "transform-[rotateY(0deg)]",
					)}
				>
					{/* Front — poster + scope scrim; tap to flip. */}
					<button
						type="button"
						data-diary-poster-trigger
						aria-expanded={expanded}
						aria-label={`${title}, ${primaryLabel}${entryCountLine ? `, ${entryCountLine}` : ""}. Show diary entries.`}
						className={cn(
							"backface-hidden absolute inset-0 cursor-pointer select-none border-0 bg-transparent p-0 text-left",
							expanded && "pointer-events-none",
						)}
						tabIndex={expanded ? -1 : 0}
						onClick={onToggleExpand}
					>
						<MoviePoster
							className="pointer-events-none size-full"
							frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
							hoverEffect="elevation"
							linkable={false}
							listingKind="tv"
							movieId={tmdbId}
							posterCaption={primaryLabel}
							posterCaptionSubline={entryCountLine}
							posterUrl={tmdbPosterUrl(posterPath)}
							priority={priority}
							showTitle={false}
							title={title}
						/>
						<ChevronDown
							className="pointer-events-none absolute top-3 right-4 z-20 size-4 text-white/80"
							aria-hidden
						/>
					</button>

					{/* Back — tap header / empty space to flip; log rows + footer stay interactive. */}
					<div
						role="presentation"
						className={cn(
							"backface-hidden transform-[rotateY(180deg)] absolute inset-0 flex cursor-pointer flex-col overflow-hidden rounded-[3rem] border-0 bg-background shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)]",
							!expanded && "pointer-events-none",
						)}
						aria-hidden={!expanded}
						onClick={handleBackFaceClick}
					>
						<div
							className={cn(
								"flex shrink-0 flex-col items-center gap-0.5 pt-4 pb-3 text-center",
								DIARY_TV_FLIP_INSET_X,
							)}
						>
							{entryCountLine ? (
								<p className="font-medium text-[11px] text-muted-foreground tracking-wide">
									{entryCountLine}
								</p>
							) : (
								<p className="font-medium text-[11px] text-muted-foreground tracking-wide">
									Diary
								</p>
							)}
							<p className="line-clamp-2 text-balance font-sans font-semibold text-foreground text-sm leading-snug tracking-tight">
								{title}
							</p>
						</div>

						<ul
							className={cn(
								"min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto",
								DIARY_TV_FLIP_INSET_X,
							)}
						>
							{logs.map((row) => (
								<li key={row.log.id}>
									<button
										type="button"
										className={cn(
											"group flex w-full items-start justify-between gap-3 py-3 text-left transition-colors",
											"active:bg-muted/45 [@media(hover:hover)]:hover:bg-muted/30",
											"active:scale-[0.99] motion-reduce:active:scale-100",
										)}
										onClick={() => {
											const payload = diaryLogToQuickLogOpenPayload(
												row,
												refresh,
											);
											if (payload) openQuickLog(payload);
										}}
									>
										<div className="min-w-0 flex-1 space-y-1">
											<TvLogScopeChip
												logScope={row.log.logScope}
												seasonNumber={row.log.seasonNumber}
												episodeNumber={row.log.episodeNumber}
												className="inline-flex rounded-full bg-muted/50 px-2.5 py-0.5 font-medium text-[10px] text-foreground tracking-wide"
											/>
											<p className="text-[11px] text-muted-foreground tabular-nums leading-none">
												{formatDate(new Date(row.log.watchedAt), {
													month: "short",
													day: "numeric",
													year: "numeric",
												})}
											</p>
										</div>
										{row.log.rating != null ? (
											<DiaryLogRatingLabel stored={row.log.rating} />
										) : (
											<span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground/60 tabular-nums">
												—
											</span>
										)}
									</button>
								</li>
							))}
						</ul>

						<div
							className={cn(
								"flex shrink-0 flex-col gap-2.5 pt-2 pb-5",
								DIARY_TV_FLIP_INSET_X,
							)}
						>
							<Link href={`/tv/${tmdbId}`} className={DIARY_FLIP_BTN_SECONDARY}>
								Open series
							</Link>
							<button
								type="button"
								className={DIARY_FLIP_BTN_PRIMARY}
								onClick={() => {
									openQuickLog({
										tvId: tmdbId,
										movieTitle: title,
										posterUrl: posterPath,
										onSuccess: refresh,
									});
								}}
							>
								Add diary entry
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
