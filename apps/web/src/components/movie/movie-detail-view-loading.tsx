import { Skeleton } from "@still/ui/components/skeleton";
import { cn } from "@still/ui/lib/utils";

import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME,
	MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
} from "@/lib/movie-detail-sections";

/** Stable keys for cast-arc placeholder cards (not list data). */
const CAST_ARC_CARD_KEYS = ["a", "b", "c", "d", "e", "f", "g"] as const;

/** Stable keys for related-title poster placeholders. */
const RELATED_POSTER_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

/** Sticky film/TV header — back pill, About/Streaming track, Share pill. */
function MovieDetailTopBarFallback() {
	return (
		<header className="sticky top-0 z-30 w-full bg-background">
			<div
				className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 sm:px-3"
				aria-hidden
			>
				<Skeleton className="h-10 w-[min(100%,7.5rem)] rounded-full bg-card/70" />
				<div className="flex shrink-0 gap-1 rounded-full bg-card p-1">
					<Skeleton className="h-10 w-19 rounded-full bg-background/80" />
					<Skeleton className="h-10 w-23 rounded-full bg-background/50" />
				</div>
				<Skeleton className="ml-auto h-10 w-[min(100%,5.5rem)] rounded-full bg-card/70" />
			</div>
		</header>
	);
}

/** Centered hero block — meta, poster, title, blurb, score row, action pills. */
export function MovieDetailHeroFallback() {
	return (
		<div
			className={cn(
				MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
				"mx-auto flex w-full max-w-lg flex-col items-center px-2.5 pt-12 pb-6 text-center sm:max-w-xl sm:px-3 sm:pt-14 sm:pb-8 md:pt-16 md:pb-10 lg:max-w-2xl lg:pt-20",
			)}
			aria-hidden
		>
			<Skeleton className="mb-5 h-3 w-40 max-w-[85%] rounded-full bg-muted/50" />
			<Skeleton className="aspect-2/3 w-full max-w-[min(100%,22rem)] rounded-[1.25rem] bg-muted/35 sm:rounded-[1.5rem]" />
			<Skeleton className="mt-7 h-9 w-[min(100%,18rem)] rounded-xl bg-muted/45 sm:h-10" />
			<Skeleton className="mt-4 h-4 w-full max-w-md rounded-md bg-muted/35" />
			<Skeleton className="mt-2 h-4 w-[min(100%,20rem)] rounded-md bg-muted/30" />
			<Skeleton className="mt-2 h-4 w-[min(100%,14rem)] rounded-md bg-muted/25" />
			<div className="mt-6 flex items-center justify-center gap-3">
				<Skeleton className="h-3 w-16 rounded-full bg-muted/35" />
				<Skeleton className="h-8 w-14 rounded-lg bg-muted/40" />
				<Skeleton className="h-3 w-16 rounded-full bg-muted/35" />
			</div>
			<div className="mt-8 flex items-center justify-center gap-3">
				<Skeleton className="size-12 shrink-0 rounded-full bg-background/80" />
				<Skeleton className="h-12 w-[min(100%,10rem)] rounded-full bg-foreground/20" />
				<Skeleton className="size-12 shrink-0 rounded-full bg-background/80" />
			</div>
		</div>
	);
}

/** About-tab body — cast arc, community tabs, and related grid placeholders. */
export function MovieDetailAboutBodyFallback({
	ariaLabel = "Loading film details",
}: {
	ariaLabel?: string;
}) {
	return (
		<div
			role="status"
			className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}
			aria-busy="true"
			aria-label={ariaLabel}
		>
			<div className="space-y-8">
				<div className="flex flex-col items-center gap-8 pt-2 pb-4 sm:pb-6">
					<Skeleton className="h-3 w-24 rounded-full bg-muted/40" />
					<div className="flex w-full max-w-4xl items-end justify-center gap-2 sm:gap-3">
						{CAST_ARC_CARD_KEYS.map((key, index) => (
							<Skeleton
								key={key}
								className="aspect-2/3 w-[min(18vw,4.5rem)] rounded-2xl bg-muted/35 sm:w-[min(14vw,5.5rem)]"
								style={{
									marginBottom:
										index === 3
											? "1.75rem"
											: index === 2 || index === 4
												? "0.75rem"
												: 0,
								}}
							/>
						))}
					</div>
				</div>

				<div className="mx-auto flex w-full max-w-md justify-center gap-2">
					<Skeleton className="h-10 w-24 rounded-full bg-background/80" />
					<Skeleton className="h-10 w-20 rounded-full bg-background/50" />
					<Skeleton className="h-10 w-24 rounded-full bg-background/50" />
				</div>

				<div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl bg-background px-6 py-8">
					<Skeleton className="h-3 w-28 rounded-full bg-muted/35" />
					<Skeleton className="h-10 w-20 rounded-lg bg-muted/40" />
					<Skeleton className="h-3 w-36 rounded-full bg-muted/30" />
				</div>

				<div className="space-y-4">
					<Skeleton className="h-28 w-full rounded-2xl bg-background/80" />
					<Skeleton className="h-28 w-full rounded-2xl bg-background/70" />
				</div>

				<div className="space-y-4 pt-2">
					<Skeleton className="mx-auto h-3 w-20 rounded-full bg-muted/35" />
					<div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-2">
						{RELATED_POSTER_KEYS.map((key) => (
							<Skeleton
								key={key}
								className="aspect-2/3 w-full rounded-[3rem] bg-muted/30"
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/** Route-level skeleton for `/movies/[id]` and `/tv/[id]`. */
export function MovieDetailViewLoading() {
	return (
		<div className="flex flex-1 flex-col bg-background">
			<MovieDetailTopBarFallback />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"flex-1 overflow-x-clip overflow-y-visible",
				)}
			>
				<article className="flex flex-1 flex-col">
					<MovieDetailHeroFallback />
					<MovieDetailAboutBodyFallback />
				</article>
			</section>
		</div>
	);
}
