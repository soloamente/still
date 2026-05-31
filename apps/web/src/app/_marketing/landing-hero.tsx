import Link from "next/link";

import { LandingHeroPreviewStage } from "./landing-hero-preview-stage";
import {
	LANDING_HERO_COPY_CLASS,
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_ROW_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_HERO_HEADLINE_CLASS,
	LANDING_HERO_MARK_CLASS,
	LANDING_HERO_PAGE_CLASS,
	LANDING_HERO_SECTION_CLASS,
	LANDING_HERO_STAGE_WRAP_CLASS,
	LANDING_HERO_SUBLINE_CLASS,
} from "./landing-mobbin-hero";
/**
 * Mobbin-pattern hero on Sense’s dark canvas — centered copy, dual pill CTAs,
 * product preview well with image placeholder card inside.
 */
export function LandingHero() {
	return (
		<section id="scene" className={LANDING_HERO_SECTION_CLASS}>
			<div className={LANDING_HERO_PAGE_CLASS}>
				<div className={LANDING_HERO_COPY_CLASS}>
					<div className={LANDING_HERO_MARK_CLASS} aria-hidden>
						<span className="size-1.5 rounded-full bg-foreground/90" />
						<span className="size-1.5 rounded-full bg-foreground/70" />
						<span className="size-1.5 rounded-full bg-foreground/50" />
					</div>

					<h1 className={LANDING_HERO_HEADLINE_CLASS}>
						Your cinematic memory, in one diary.
					</h1>

					<p className={LANDING_HERO_SUBLINE_CLASS}>
						Log films and shows with venue and date intact — then share lists,
						reviews, and ranks with people who watch like you do.
					</p>

					<div className={LANDING_HERO_CTA_ROW_CLASS}>
						<Link href="/sign-up" className={LANDING_HERO_CTA_PRIMARY_CLASS}>
							Create account
						</Link>
						<Link href="/sign-in" className={LANDING_HERO_CTA_SECONDARY_CLASS}>
							Sign in
						</Link>
					</div>
				</div>

				<div className={LANDING_HERO_STAGE_WRAP_CLASS}>
					<LandingHeroPreviewStage />
				</div>
			</div>
		</section>
	);
}
