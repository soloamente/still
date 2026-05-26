"use client";

import { cn } from "@still/ui/lib/utils";
import {
	type MotionValue,
	motion,
	useReducedMotion,
	useScroll,
	useTransform,
} from "motion/react";
import Image from "next/image";
import { useRef } from "react";

import { LANDING_GLASS_PILL } from "./landing-glass";
import { type LandingPoster, landingSceneImageUrl } from "./landing-poster";

interface SceneCardConfig {
	poster: LandingPoster;
	side: "left" | "right";
	/** When this card enters the scroll timeline (0–1). */
	enter: number;
}

function FloatingSceneCard({
	poster,
	side,
	enter,
	progress,
}: {
	poster: LandingPoster;
	side: "left" | "right";
	enter: number;
	progress: MotionValue<number>;
}) {
	const reduceMotion = useReducedMotion();
	const src = landingSceneImageUrl(poster);
	const exit = Math.min(enter + 0.55, 0.98);

	const y = useTransform(
		progress,
		[enter, exit],
		reduceMotion ? [0, 0] : [140, -160],
	);
	const x = useTransform(
		progress,
		[enter, exit],
		reduceMotion ? [0, 0] : side === "left" ? [-280, -40] : [280, 40],
	);
	const opacity = useTransform(
		progress,
		[enter, enter + 0.12, exit - 0.08, exit],
		reduceMotion ? [1, 1, 1, 1] : [0, 1, 1, 0],
	);
	const scale = useTransform(
		progress,
		[enter, exit],
		reduceMotion ? [1, 1] : [0.94, 1],
	);

	if (!src) return null;

	return (
		<motion.div
			className={cn(
				"pointer-events-none absolute top-1/2 w-[min(42vw,22rem)] -translate-y-1/2",
				side === "left" ? "left-4 lg:left-10" : "right-4 lg:right-10",
			)}
			style={{ y, x, opacity, scale }}
		>
			<div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-card">
				<Image
					src={src}
					alt=""
					fill
					sizes="(min-width: 1024px) 352px, 42vw"
					className="object-cover"
				/>
			</div>
			<span
				className={cn(
					LANDING_GLASS_PILL,
					"absolute top-4 left-4 max-w-[calc(100%-2rem)] truncate px-3 py-1.5 font-sans text-foreground/90 text-xs",
				)}
			>
				{poster.title}
			</span>
		</motion.div>
	);
}

/**
 * Scroll chapter — centered copy stays; scene posters float up on left and right.
 */
export function LandingScrollScenes({ posters }: { posters: LandingPoster[] }) {
	const ref = useRef<HTMLElement>(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start start", "end end"],
	});

	const scenes: SceneCardConfig[] = posters
		.filter((p) => landingSceneImageUrl(p))
		.slice(0, 6)
		.map((poster, index) => ({
			poster,
			side: index % 2 === 0 ? "left" : "right",
			enter: 0.06 + index * 0.12,
		}));

	return (
		<section
			ref={ref}
			aria-label="Featured screenings"
			className="relative h-[320vh] bg-card"
		>
			<div className="sticky top-0 flex min-h-[100dvh] items-center justify-center overflow-hidden">
				<div className="relative z-10 mx-auto max-w-[20ch] px-4 text-center">
					<h2 className="font-sans font-semibold text-[clamp(2rem,5vw,3.25rem)] text-foreground/90 tracking-[-0.04em]">
						Unforgettable screenings.
					</h2>
					<p className="mt-6 text-base text-muted-foreground leading-relaxed">
						Log venue and date, rate on a 10.0 scale, and keep theatres separate
						from streaming.
					</p>
				</div>

				{scenes.map((scene) => (
					<FloatingSceneCard
						key={scene.poster.id}
						poster={scene.poster}
						side={scene.side}
						enter={scene.enter}
						progress={scrollYProgress}
					/>
				))}
			</div>
		</section>
	);
}
