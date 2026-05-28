import {
	LandingFeatureAddToListVisual,
	LandingFeatureQuickLogVisual,
	LandingFeatureRanksVisual,
	LandingFeatureReviewVisual,
	LandingFeatureSearchVisual,
	LandingFeatureTvWatchVisual,
} from "./landing-feature-visuals";
import {
	LANDING_FEATURE_COLUMN_BODY_CLASS,
	LANDING_FEATURE_COLUMN_TITLE_CLASS,
	LANDING_FEATURE_WELL_CLASS,
	LANDING_FEATURE_WELL_INNER_CLASS,
	LANDING_FEATURES_SECTION_TITLE_CLASS,
	LANDING_SECTION_CLASS,
	LANDING_SECTION_INNER_CLASS,
} from "./landing-mobbin-hero";
import type { LandingPoster } from "./landing-poster";
import { LandingScrollReveal } from "./landing-scroll-reveal";

const FEATURES = [
	{
		title: "Quick log",
		body: "Log venue, date, and score in one pass — defaults to at home, with cinema when you need it.",
		visual: "quick-log" as const,
	},
	{
		title: "Add to list",
		body: "Save titles to watchlists and curated lists — ranked walls with custom covers when you want them.",
		visual: "add-to-list" as const,
	},
	{
		title: "Leave a review",
		body: "Write long-form reviews on a 10.0 scale so your take stays attached to the title.",
		visual: "review" as const,
	},
	{
		title: "Search & browse",
		body: "Find films and shows from any page — token pills, genre chips, and inline poster results.",
		visual: "search" as const,
	},
	{
		title: "Track TV",
		body: "Watching status, season scope, and episode progress — plus scoped diary logs per show.",
		visual: "tv-watch" as const,
	},
	{
		title: "Community ranks",
		body: "Film and TV leaderboards by week, month, or year — tap a patron or open their watch ledger.",
		visual: "ranks" as const,
	},
] as const;

function FeatureSpecimen({
	kind,
	posters,
}: {
	kind: (typeof FEATURES)[number]["visual"];
	posters: LandingPoster[];
}) {
	switch (kind) {
		case "quick-log":
			return <LandingFeatureQuickLogVisual />;
		case "add-to-list":
			return <LandingFeatureAddToListVisual posters={posters} />;
		case "review":
			return <LandingFeatureReviewVisual />;
		case "search":
			return <LandingFeatureSearchVisual posters={posters} />;
		case "tv-watch":
			return <LandingFeatureTvWatchVisual posters={posters} />;
		case "ranks":
			return <LandingFeatureRanksVisual />;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/**
 * Mobbin “From inspiration to creation” — centered title, square specimen wells,
 * copy centered beneath each column (3×2 grid on large screens).
 */
export function LandingFeatures({
	posters = [],
}: {
	posters?: LandingPoster[];
}) {
	return (
		<section id="diary" className={`${LANDING_SECTION_CLASS} scroll-mt-24`}>
			<div className={LANDING_SECTION_INNER_CLASS}>
				<LandingScrollReveal>
					<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
						From logging to sharing it
					</h2>
				</LandingScrollReveal>

				<ul className="mt-16 grid list-none gap-x-8 gap-y-14 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
					{FEATURES.map((feature) => (
						<li key={feature.title} className="w-full">
							<LandingScrollReveal>
								<article className="flex w-full flex-col items-center">
									<div className={LANDING_FEATURE_WELL_CLASS}>
										<div className={LANDING_FEATURE_WELL_INNER_CLASS}>
											<FeatureSpecimen
												kind={feature.visual}
												posters={posters}
											/>
										</div>
									</div>
									<h3 className={LANDING_FEATURE_COLUMN_TITLE_CLASS}>
										{feature.title}
									</h3>
									<p className={LANDING_FEATURE_COLUMN_BODY_CLASS}>
										{feature.body}
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
