"use client";

import { useReducedMotion, useScroll } from "motion/react";
import { useRef } from "react";

import { LANDING_SECTION_INNER_CLASS } from "./landing-mobbin-hero";
import { LandingIntroRevealCopy } from "./landing-text-box-reveal";

const INTRO_MANIFESTO_COPY =
	"Still is a cinematic diary for how you actually watch — cinema nights, living-room marathons, and the taste you build over time.";

/**
 * La Nube-style intro — tall scroll track with sticky manifesto copy that
 * scrubs in character-by-character as you scroll.
 */
export function LandingIntroScrollChapter() {
	const sectionRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({
		target: sectionRef,
		offset: ["start start", "end end"],
	});

	return (
		<section
			ref={sectionRef}
			className="relative h-[200lvh] bg-background"
			aria-label="About Still"
		>
			<div className="sticky top-0 flex min-h-dvh items-center">
				<div className={`${LANDING_SECTION_INNER_CLASS} w-full px-4 sm:px-6`}>
					{reduceMotion ? (
						<p className="max-w-360 text-balance font-medium font-sans text-[clamp(1.5rem,4vw,2.75rem)] text-foreground leading-[1.2] tracking-[-0.03em]">
							{INTRO_MANIFESTO_COPY}
						</p>
					) : (
						<LandingIntroRevealCopy
							text={INTRO_MANIFESTO_COPY}
							highlight="watch"
							progress={scrollYProgress}
						/>
					)}
				</div>
			</div>
		</section>
	);
}
