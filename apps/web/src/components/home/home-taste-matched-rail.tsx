"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useState } from "react";

import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { HomeTasteMatchedRailSkeleton } from "@/components/home/home-taste-matched-rail-skeleton";
import { api } from "@/lib/api";
import {
	type TasteMatchedDiscoveryPayload,
	tasteMatchedRailTitle,
} from "@/lib/taste-matched-discovery";

const RAIL_POSTER_FRAME_CLASSNAME = "rounded-2xl border-0 bg-background";

function tmdbPosterUrl(posterPath: string | null): string | null {
	if (!posterPath?.length) return null;
	if (posterPath.startsWith("http")) return posterPath;
	const fragment = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

function tasteRailIsEmpty(
	payload: TasteMatchedDiscoveryPayload | null,
): boolean {
	if (!payload) return true;
	return payload.coldStart || payload.movies.length === 0;
}

/**
 * Signed-in Movies lobby rail — rule-based picks from diary taste (ST.4).
 * Prefer `initial` from `/home` RSC so the rail paints with the catalogue, not after a client waterfall.
 */
export function HomeTasteMatchedRail({
	initial,
}: {
	/** From `GET /api/taste/for-you` on the home RSC; omit only for client-only fallback. */
	initial?: TasteMatchedDiscoveryPayload | null;
}) {
	const [payload, setPayload] = useState<TasteMatchedDiscoveryPayload | null>(
		initial ?? null,
	);
	const [loading, setLoading] = useState(initial === undefined);

	useEffect(() => {
		if (initial === undefined) return;
		setPayload(initial);
		setLoading(false);
	}, [initial]);

	useEffect(() => {
		if (initial !== undefined) return;

		let cancelled = false;
		async function load() {
			try {
				const res = await api.api.taste["for-you"].get();
				if (cancelled) return;
				if (res.error || !res.data) {
					setPayload(null);
					return;
				}
				setPayload(res.data as TasteMatchedDiscoveryPayload);
			} catch {
				if (!cancelled) setPayload(null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [initial]);

	if (loading) {
		return <HomeTasteMatchedRailSkeleton />;
	}

	if (tasteRailIsEmpty(payload)) {
		return null;
	}

	const rail = payload as TasteMatchedDiscoveryPayload;

	return (
		<section
			aria-label="Films matched to your taste"
			className="shrink-0 space-y-2.5"
		>
			<h2 className="text-balance font-medium text-muted-foreground text-xs tracking-wide">
				{tasteMatchedRailTitle(rail.genrePhrase)}
			</h2>
			<div
				className={cn(
					"scrollbar-none flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5",
					"[-webkit-overflow-scrolling:touch]",
				)}
			>
				{rail.movies.map((film, index) => (
					<div
						key={film.tmdbId}
						className="flex w-27 shrink-0 flex-col sm:w-30"
					>
						<CataloguePosterTile
							className="w-full min-w-0"
							frameClassName={RAIL_POSTER_FRAME_CLASSNAME}
							hoverEffect="elevation"
							listingKind="movie"
							posterUrl={tmdbPosterUrl(film.posterPath)}
							priority={index < 4}
							surface="home"
							title={film.title}
							tmdbId={film.tmdbId}
						/>
						<p className="mt-1.5 line-clamp-2 w-full text-[11px] text-muted-foreground leading-snug">
							{film.title}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}
