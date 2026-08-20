import Link from "next/link";

import { LANDING_CONVERT_COPY, LANDING_CTA } from "./landing-copy";
import {
	LANDING_FEATURES_SECTION_TITLE_CLASS,
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_ROW_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
} from "./landing-mobbin-hero";

export function LandingConvert() {
	return (
		<section id="start" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
			<div className="mx-auto max-w-[40ch] text-center">
				<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
					{LANDING_CONVERT_COPY.heading}
				</h2>
				<p className="mt-4 text-pretty font-sans text-muted-foreground text-sm leading-relaxed">
					{LANDING_CONVERT_COPY.body}
				</p>
				<div className={`${LANDING_HERO_CTA_ROW_CLASS} justify-center`}>
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
