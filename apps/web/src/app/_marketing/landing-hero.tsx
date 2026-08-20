import Link from "next/link";

import { LANDING_CTA, LANDING_HERO_COPY } from "./landing-copy";
import { LandingHeroSpiral } from "./landing-hero-spiral";
import type { LandingHeroPoster } from "./landing-hero-still";
import {
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_ROW_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_HERO_HEADLINE_CLASS,
	LANDING_HERO_SUBLINE_CLASS,
} from "./landing-mobbin-hero";

/**
 * Full first-viewport identity hero — Originkit spiral as edge-to-edge
 * background, type + CTAs centered on top. Floating nav overlays this band.
 */
export function LandingHero({
	posters,
}: {
	posters: readonly LandingHeroPoster[];
}) {
	return (
		<section
			id="scene"
			data-landing-posters={posters.length}
			className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-background px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-20"
		>
			{posters.length > 0 ? (
				<div className="pointer-events-none absolute inset-0" aria-hidden>
					<LandingHeroSpiral posters={posters} />
					{/* Field veil + center well — keep posters readable at the rim. */}
					<div className="absolute inset-0 bg-background/25" />
					<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--background)_90%,transparent)_0%,color-mix(in_oklab,var(--background)_78%,transparent)_28%,color-mix(in_oklab,var(--background)_40%,transparent)_55%,transparent_82%)]" />
				</div>
			) : null}

			<div className="relative z-10 mx-auto flex w-full max-w-mobbin-page flex-col items-center text-center">
				{/* Local shadow pool behind the type block only. */}
				<div
					className="pointer-events-none absolute top-1/2 left-1/2 h-[min(22rem,70%)] w-[min(42rem,100%)] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[radial-gradient(circle,var(--background)_0%,color-mix(in_oklab,var(--background)_90%,transparent)_45%,transparent_72%)]"
					aria-hidden
				/>
				<h1 className={`relative ${LANDING_HERO_HEADLINE_CLASS}`}>
					{LANDING_HERO_COPY.headline}
				</h1>
				<p className={`relative ${LANDING_HERO_SUBLINE_CLASS} text-pretty`}>
					{LANDING_HERO_COPY.subline}
				</p>
				<div className={`relative ${LANDING_HERO_CTA_ROW_CLASS}`}>
					<Link
						href={LANDING_CTA.primary.href}
						className={LANDING_HERO_CTA_PRIMARY_CLASS}
					>
						{LANDING_CTA.primary.label}
					</Link>
					<Link
						href={LANDING_CTA.secondary.href}
						className={LANDING_HERO_CTA_SECONDARY_CLASS}
					>
						{LANDING_CTA.secondary.label}
					</Link>
				</div>
			</div>
		</section>
	);
}
