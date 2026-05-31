import { APP_NAME } from "@/lib/app-brand";
import {
	LandingFeatureCommunityVisual,
	LandingFeatureSearchVisual,
} from "./landing-feature-visuals";
import {
	LANDING_FEATURE_COLUMN_BODY_CLASS,
	LANDING_FEATURE_COLUMN_TITLE_CLASS,
	LANDING_FEATURES_SECTION_TITLE_CLASS,
	LANDING_SECTION_CLASS,
	LANDING_SECTION_INNER_CLASS,
	LANDING_SPLIT_WELL_CLASS,
} from "./landing-mobbin-hero";
import type { LandingPoster } from "./landing-poster";
import { LandingScrollReveal } from "./landing-scroll-reveal";

const FLOW_COLUMNS = [
	{
		title: "Browse lobbies",
		body: "Movies and TV catalogues with venue chips — upcoming, latest, and popular without leaving home.",
		visual: "browse" as const,
	},
	{
		title: "Follow friend activity",
		body: "Reviews, lists, and logs from people you follow — flat feed tiles on a calm community canvas.",
		visual: "activity" as const,
	},
] as const;

/**
 * Mobbin “Explore entire user journeys with flows” — two-up columns with specimen wells.
 */
export function LandingFlows({ posters = [] }: { posters?: LandingPoster[] }) {
	return (
		<section id="work" className={`${LANDING_SECTION_CLASS} scroll-mt-24`}>
			<div className={LANDING_SECTION_INNER_CLASS}>
				<LandingScrollReveal>
					<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
						Explore how watching flows through {APP_NAME}
					</h2>
				</LandingScrollReveal>

				<ul className="mt-14 grid list-none gap-14 sm:mt-16 lg:grid-cols-2 lg:gap-10">
					{FLOW_COLUMNS.map((column) => (
						<li key={column.title}>
							<LandingScrollReveal>
								<article className="flex flex-col items-center">
									<div className={LANDING_SPLIT_WELL_CLASS}>
										{column.visual === "browse" ? (
											<LandingFeatureSearchVisual posters={posters} />
										) : (
											<LandingFeatureCommunityVisual />
										)}
									</div>
									<h3 className={LANDING_FEATURE_COLUMN_TITLE_CLASS}>
										{column.title}
									</h3>
									<p className={LANDING_FEATURE_COLUMN_BODY_CLASS}>
										{column.body}
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
