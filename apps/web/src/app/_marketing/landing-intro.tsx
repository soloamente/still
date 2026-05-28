import { LandingIntroScrollChapter } from "./landing-intro-scroll-chapter";
import {
	LANDING_FEATURES_SECTION_TITLE_CLASS,
	LANDING_SECTION_CLASS,
	LANDING_SECTION_INNER_CLASS,
	LANDING_STATS_LABEL_CLASS,
	LANDING_STATS_VALUE_CLASS,
} from "./landing-mobbin-hero";
import { LandingScrollReveal } from "./landing-scroll-reveal";

const STATS = [
	{ value: "2", label: "media kinds — films & TV" },
	{ value: "10.0", label: "patron rating scale" },
	{ value: "4", label: "community surfaces" },
] as const;

/**
 * `#intro` — scroll-scrub manifesto, then Mobbin stats band.
 */
export function LandingIntro() {
	return (
		<section id="intro" className="scroll-mt-24 bg-background">
			<LandingIntroScrollChapter />

			<div className={LANDING_SECTION_CLASS}>
				<div className={LANDING_SECTION_INNER_CLASS}>
					<LandingScrollReveal>
						<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
							A growing diary for how you watch
						</h2>
					</LandingScrollReveal>

					<ul className="mt-14 grid list-none gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-8">
						{STATS.map((stat, index) => (
							<li key={stat.label} className="text-center">
								<LandingScrollReveal delay={index * 0.06}>
									<p className={LANDING_STATS_VALUE_CLASS}>{stat.value}</p>
									<p className={LANDING_STATS_LABEL_CLASS}>{stat.label}</p>
								</LandingScrollReveal>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
