"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

type Poster = { id: number; title: string; posterUrl: string | null };

/**
 * Animated mosaic of popular posters. Posters drift in on mount with a
 * light stagger; tilt per index keeps the rail feeling hand-arranged.
 * Decorative: aria-hidden, gradient mask softens the edges.
 * Track B.6: durations ≤200ms; stagger dropped when `prefers-reduced-motion`.
 * When nested inside `<Letterbox>`, use `h-full` + `min-h-*` so the mosaic
 * fills the widescreen frame instead of a fixed pixel height.
 */
export function LandingPosterRail({
	posters,
	className,
}: {
	posters: Poster[];
	/** Merge classes when the rail sits inside a letterboxed hero (Phase 1). */
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	// Layout: three loose rows on desktop, single rail on small screens.
	const rows = [
		posters.slice(0, 5),
		posters.slice(5, 10),
		posters.slice(10, 14),
	];
	return (
		<div
			aria-hidden
			className={cn(
				"relative isolate hidden h-full min-h-[280px] [mask-image:linear-gradient(180deg,transparent_0%,black_15%,black_85%,transparent_100%)] md:block",
				className,
			)}
		>
			<div className="absolute inset-0 -right-12 flex flex-col gap-3">
				{rows.map((row, rowIdx) => (
					<div
						key={`landing-row-${row.length ? row.map((p) => p.id).join("-") : `r-${rowIdx}`}`}
						className={cn(
							"flex gap-3",
							rowIdx % 2 === 0 ? "translate-x-0" : "translate-x-8",
						)}
					>
						{row.map((poster, i) => {
							const index = rowIdx * 5 + i;
							const rotate = ((rowIdx + i) % 2 === 0 ? -1 : 1) * 1.5;
							return (
								<motion.div
									key={poster.id}
									initial={
										reduceMotion
											? { opacity: 1, y: 0, rotate }
											: { opacity: 0, y: 12, rotate: 0 }
									}
									animate={{ opacity: 1, y: 0, rotate }}
									transition={{
										duration: reduceMotion ? 0 : 0.2,
										delay: reduceMotion ? 0 : Math.min(0.02 * index, 0.1),
										ease: [0.165, 0.84, 0.44, 1],
									}}
									className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-md border border-border bg-card shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]"
								>
									{poster.posterUrl ? (
										<Image
											src={poster.posterUrl}
											alt=""
											fill
											sizes="(min-width: 768px) 96px, 0px"
											className="object-cover"
										/>
									) : (
										<div className="size-full bg-muted" />
									)}
								</motion.div>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
}
