"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { LANDING_GLASS_PANEL, LANDING_GLASS_PILL } from "./landing-glass";
import type { LandingPoster } from "./landing-poster";

/**
 * La Nube #homeintro — full-bleed media, centered headline, glass media pager.
 */
export function LandingHero({ posters = [] }: { posters?: LandingPoster[] }) {
	const slides = posters.filter((p) => p.posterUrl).slice(0, 5);
	const [activeIndex, setActiveIndex] = useState(0);
	const active = slides[activeIndex] ?? slides[0];

	return (
		<section
			id="scene"
			className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden"
		>
			<div className="absolute inset-0 bg-background">
				{active?.posterUrl ? (
					<Image
						key={active.id}
						src={active.posterUrl}
						alt=""
						fill
						priority
						sizes="100vw"
						className="object-cover opacity-[0.72] transition-opacity duration-500"
					/>
				) : null}
				{/* Flat vertical scrim only — no radial spotlights. */}
				<div
					aria-hidden
					className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/45 to-background/90"
				/>
			</div>

			<div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-36 text-center sm:pb-40">
				<h1 className="max-w-[15ch] text-balance font-sans font-semibold text-[clamp(2.25rem,6.5vw,4.5rem)] text-foreground leading-[1.05] tracking-[-0.04em]">
					Cinematic diary experiences
				</h1>

				<Link
					href="#intro"
					className={cn(
						LANDING_GLASS_PILL,
						"mt-8 inline-flex h-11 items-center px-7 font-sans text-foreground text-sm transition-colors duration-200 [@media(hover:hover)]:bg-white/[0.14]",
					)}
				>
					Learn more
				</Link>
			</div>

			{slides.length > 0 ? (
				<div className="pointer-events-auto absolute inset-x-0 bottom-8 z-10 flex justify-center px-4 sm:bottom-10">
					<fieldset
						className={cn(
							LANDING_GLASS_PANEL,
							"m-0 flex min-w-0 items-center gap-1 border-0 p-1.5",
						)}
						aria-label="Change media"
					>
						{slides.map((poster, index) => {
							const selected = index === activeIndex;
							return (
								<button
									key={poster.id}
									type="button"
									aria-label={`Change media — ${poster.title}`}
									aria-pressed={selected}
									onClick={() => setActiveIndex(index)}
									className={cn(
										"relative h-[57px] w-[82px] shrink-0 overflow-hidden rounded-2xl transition-opacity duration-200",
										selected
											? "opacity-100"
											: "opacity-50 [@media(hover:hover)]:opacity-75",
									)}
								>
									{poster.posterUrl ? (
										<Image
											src={poster.posterUrl}
											alt=""
											fill
											sizes="82px"
											className="object-cover"
										/>
									) : (
										<div className="size-full bg-muted" />
									)}
								</button>
							);
						})}
					</fieldset>
				</div>
			) : null}
		</section>
	);
}
