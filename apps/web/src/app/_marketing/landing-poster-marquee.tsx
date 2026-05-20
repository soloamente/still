"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import type { LandingPoster } from "./landing-preview";

/**
 * Seamless horizontal poster loop — Mobbin homepage gallery band adapted to Still posters.
 * GPU-friendly `x` transform only; pauses when `prefers-reduced-motion`.
 */
export function LandingPosterMarquee({
	posters,
}: {
	posters: LandingPoster[];
}) {
	const reduceMotion = useReducedMotion();
	if (posters.length === 0) return null;

	// Duplicate strip so `-50%` translation loops without a visible seam.
	const loop = [
		...posters.map((poster) => ({ poster, segment: "a" as const })),
		...posters.map((poster) => ({ poster, segment: "b" as const })),
	];

	return (
		<div
			aria-hidden
			className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]"
		>
			<motion.ul
				className="flex w-max gap-3 px-3 will-change-transform"
				animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
				transition={
					reduceMotion
						? undefined
						: {
								duration: Math.max(28, posters.length * 2.2),
								repeat: Number.POSITIVE_INFINITY,
								ease: "linear",
							}
				}
			>
				{loop.map(({ poster, segment }) => (
					<li
						key={`${poster.id}-${segment}`}
						className={cn(
							"relative aspect-[2/3] w-[5.5rem] shrink-0 overflow-hidden rounded-2xl bg-background shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)] sm:w-28",
						)}
					>
						{poster.posterUrl ? (
							<Image
								src={poster.posterUrl}
								alt=""
								fill
								sizes="112px"
								className="object-cover"
							/>
						) : (
							<div className="size-full bg-muted" />
						)}
					</li>
				))}
			</motion.ul>
		</div>
	);
}
