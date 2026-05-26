import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

import type { LandingPoster } from "./landing-poster";
import { LandingScrollReveal } from "./landing-scroll-reveal";
import { LANDING_VIEWPORT_SECTION } from "./landing-section";

export type { LandingPoster } from "./landing-poster";

/** Catalogue — full viewport lead, lobby grid continues below the fold. */
export function LandingPreview({ posters }: { posters: LandingPoster[] }) {
	const gridPosters = posters.slice(0, 12);

	return (
		<section id="catalogue" className="bg-background">
			<div
				className={`${LANDING_VIEWPORT_SECTION} items-center justify-center px-4 sm:px-6`}
			>
				<LandingScrollReveal>
					<h2 className="mx-auto max-w-[20ch] text-center font-sans font-semibold text-[clamp(1.75rem,4vw,2.5rem)] text-foreground/85 tracking-[-0.035em]">
						Every search opens a new lobby.
					</h2>
				</LandingScrollReveal>
			</div>

			<ul
				className={cn(
					HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
					"mx-auto max-w-[1400px] px-4 pb-24 sm:px-6 sm:pb-32",
				)}
			>
				{gridPosters.map((poster) => (
					<li key={poster.id} className="min-w-0 list-none">
						<div
							className={cn(
								HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
								"relative aspect-[2/3] overflow-hidden rounded-2xl bg-card",
							)}
						>
							{poster.posterUrl ? (
								<Image
									src={poster.posterUrl}
									alt=""
									fill
									sizes="(min-width: 1280px) 200px, (min-width: 768px) 18vw, 45vw"
									className="poster-art object-cover"
								/>
							) : (
								<div className="poster-art size-full bg-muted" aria-hidden />
							)}
						</div>
						<p className="mt-2 truncate text-center text-muted-foreground text-xs">
							{poster.title}
						</p>
					</li>
				))}
			</ul>
		</section>
	);
}
