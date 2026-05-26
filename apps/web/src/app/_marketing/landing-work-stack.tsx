"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import { LANDING_GLASS_PILL } from "./landing-glass";
import { type LandingPoster, landingSceneImageUrl } from "./landing-poster";
import { LANDING_VIEWPORT_SECTION } from "./landing-section";

/** La Nube work deck — full-screen chapter, landscape scene plates stacked vertically. */
export function LandingWorkStack({ posters }: { posters: LandingPoster[] }) {
	const stack = posters.filter((p) => landingSceneImageUrl(p)).slice(0, 5);

	if (stack.length === 0) return null;

	const stackInset = (stack.length - 1) * 28;

	return (
		<section
			id="work"
			className={cn(LANDING_VIEWPORT_SECTION, "bg-background")}
		>
			<div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center px-4 py-24 sm:px-6">
				<h2 className="max-w-[22ch] text-center font-sans font-semibold text-[clamp(1.75rem,4vw,2.75rem)] text-foreground/85 tracking-[-0.035em]">
					Spatial grandeur with minimal materiality, tailor-made.
				</h2>

				<div
					className="relative mt-12 w-full max-w-4xl sm:mt-16"
					style={{ paddingTop: stackInset }}
				>
					{/* Landscape scene plates — backs peek from above, front rectangle on top. */}
					{stack.map((poster, index) => {
						const isFront = index === stack.length - 1;
						const src = landingSceneImageUrl(poster);

						return (
							<article
								key={poster.id}
								className={cn(
									"aspect-[16/9] w-full overflow-hidden rounded-[2.5rem] bg-card",
									isFront
										? "relative z-10"
										: "pointer-events-none absolute inset-x-0",
								)}
								style={
									isFront
										? undefined
										: {
												top: index * 28,
												zIndex: index,
												transform: `scale(${1 - (stack.length - 1 - index) * 0.028})`,
												opacity: 1 - (stack.length - 1 - index) * 0.16,
											}
								}
							>
								{src ? (
									<Image
										src={src}
										alt=""
										fill
										sizes="(min-width: 1024px) 896px, 92vw"
										className="object-cover"
										priority={isFront}
									/>
								) : (
									<div className="size-full bg-muted" />
								)}
								{isFront ? (
									<div className="absolute inset-x-0 bottom-0 flex justify-center px-6 pt-16 pb-8">
										<span
											className={cn(
												LANDING_GLASS_PILL,
												"max-w-[90%] truncate px-5 py-2.5 font-sans text-foreground/95 text-sm",
											)}
										>
											{poster.title}
										</span>
									</div>
								) : null}
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}
