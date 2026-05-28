import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import {
	LANDING_FEATURES_SECTION_TITLE_CLASS,
	LANDING_FILTER_PILL_ACTIVE_CLASS,
	LANDING_FILTER_PILL_CLASS,
	LANDING_PATTERN_CARD_CLASS,
	LANDING_SECTION_CLASS,
	LANDING_SECTION_INNER_CLASS,
} from "./landing-mobbin-hero";
import type { LandingPoster } from "./landing-poster";
import { LandingScrollReveal } from "./landing-scroll-reveal";

export type { LandingPoster } from "./landing-poster";

const FILTER_PILLS = [
	{ label: "Movies", active: true },
	{ label: "TV", active: false },
	{ label: "In cinemas", active: false },
	{ label: "Streaming", active: false },
] as const;

const PATTERN_LABELS = [
	"Home",
	"Diary",
	"Lists",
	"Reviews",
	"Activity",
	"Film ranks",
	"Watchlist",
	"Search",
] as const;

/**
 * Mobbin “Find design patterns in seconds” — filter pills + poster pattern grid.
 */
export function LandingPreview({ posters }: { posters: LandingPoster[] }) {
	const gridPosters = posters.filter((p) => p.posterUrl).slice(0, 8);

	return (
		<section id="catalogue" className={`${LANDING_SECTION_CLASS} scroll-mt-24`}>
			<div className={LANDING_SECTION_INNER_CLASS}>
				<LandingScrollReveal>
					<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
						Find what to watch in seconds
					</h2>
				</LandingScrollReveal>

				<div
					className="mt-10 flex flex-wrap justify-center gap-2 sm:mt-12"
					aria-hidden
				>
					{FILTER_PILLS.map((pill) => (
						<span
							key={pill.label}
							className={
								pill.active
									? LANDING_FILTER_PILL_ACTIVE_CLASS
									: LANDING_FILTER_PILL_CLASS
							}
						>
							{pill.label}
						</span>
					))}
				</div>

				<ul
					className={cn(
						"mt-10 grid list-none grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:mt-12",
					)}
				>
					{gridPosters.map((poster, index) => (
						<li key={poster.id}>
							<LandingScrollReveal>
								<article className={LANDING_PATTERN_CARD_CLASS}>
									<div className="relative aspect-2/3 overflow-hidden rounded-xl bg-muted">
										<Image
											src={poster.posterUrl ?? ""}
											alt=""
											fill
											sizes="(min-width: 1280px) 200px, 25vw"
											className="poster-art object-cover"
										/>
									</div>
									<p className="mt-2 truncate text-center font-sans text-foreground text-xs">
										{PATTERN_LABELS[index % PATTERN_LABELS.length]}
									</p>
								</article>
							</LandingScrollReveal>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
