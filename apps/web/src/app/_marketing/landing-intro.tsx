"use client";

import { useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { LandingIntroRevealCopy } from "./landing-text-box-reveal";

const INTRO_COPY =
	"Still is a diary for film and television that keeps venue, date, and taste intact — turning what you watch into a calm record you can share.";

/**
 * La Nube `section.home_txt` pattern: tall section (`200lvh`) is the scroll track;
 * inner `div.grid-vw` stays `sticky` + `100lvh` while scroll scrubs the reveal.
 */
export function LandingIntro() {
	const sectionRef = useRef<HTMLElement>(null);
	const reduceMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({
		target: sectionRef,
		offset: ["start start", "end end"],
	});

	const revealProgress = useTransform(scrollYProgress, [0, 1], [0, 1]);

	if (reduceMotion) {
		return (
			<section
				id="intro"
				aria-label="Introduction"
				className="mx-auto flex min-h-dvh max-w-[90rem] items-center bg-card px-4 py-20 sm:px-6"
			>
				<p className="text-center font-medium font-sans text-[clamp(1.5rem,4vw,2.75rem)] text-foreground/85 leading-[1.2] tracking-[-0.03em]">
					{INTRO_COPY}
				</p>
			</section>
		);
	}

	return (
		<section
			ref={sectionRef}
			id="intro"
			aria-label="Introduction"
			className="relative min-h-[200lvh] bg-card"
		>
			{/* Pinned viewport panel — mirrors Espacio La Nube `.home_txt .grid-vw`. */}
			<div className="sticky top-0 z-10 mx-auto flex h-lvh w-full max-w-[90rem] flex-col items-center justify-center gap-10 px-4 text-center sm:px-6 md:px-[3.75rem]">
				<LandingIntroRevealCopy
					text={INTRO_COPY}
					highlight="taste"
					progress={revealProgress}
				/>
			</div>
		</section>
	);
}
