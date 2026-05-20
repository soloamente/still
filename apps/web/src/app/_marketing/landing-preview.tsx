import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

import { LandingPosterMarquee } from "./landing-poster-marquee";

export type LandingPoster = {
	id: number;
	title: string;
	posterUrl: string | null;
};

/**
 * Mobbin “product shelf” — large raised panel with rounded top, catalogue grid inside.
 * Mirrors `/home` lobby poster geometry so marketing matches the signed-in experience.
 */
export function LandingPreview({ posters }: { posters: LandingPoster[] }) {
	const gridPosters = posters.slice(0, 12);

	return (
		<section
			id="preview"
			className="relative mx-auto w-full max-w-[min(100%,90rem)] scroll-mt-24 px-4 pb-4 sm:px-6"
		>
			<div
				className={cn(
					"overflow-hidden rounded-t-[2.5rem] bg-card shadow-mobbin-xl sm:rounded-t-[3rem]",
					"pt-8 pb-10 sm:pt-10",
				)}
			>
				<div className="mx-auto max-w-mobbin-page px-4 sm:px-8">
					<p className="text-center font-medium font-sans text-muted-foreground text-sm">
						Browse like you will on{" "}
						<span className="text-foreground">Still</span>
					</p>
					<h2 className="mt-2 text-center font-sans font-semibold text-2xl tracking-[-0.02em] md:text-3xl">
						Theatres, streaming, upcoming — one lobby.
					</h2>
				</div>

				{/* Infinite marquee — Mobbin gallery motion on poster rails. */}
				<div className="mt-8">
					<LandingPosterMarquee
						posters={posters.length ? posters : gridPosters}
					/>
				</div>

				{/* Static grid snapshot — same card radii as home catalogue. */}
				<div className="mx-auto mt-10 max-w-mobbin-page px-4 sm:px-8">
					<ul className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}>
						{gridPosters.map((poster) => (
							<li key={poster.id} className="min-w-0 list-none">
								<div
									className={cn(
										HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
										"relative aspect-[2/3] overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.55)]",
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
										<div
											className="poster-art size-full bg-muted"
											aria-hidden
										/>
									)}
								</div>
								<p className="mt-2 truncate text-center text-muted-foreground text-xs">
									{poster.title}
								</p>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
