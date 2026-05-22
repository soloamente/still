"use client";

import type { ReactNode } from "react";

import { TvDetailWatchProvider } from "@/components/tv/tv-detail-watch-context";

/**
 * Client boundary for `/tv/[id]` — one provider for diary + `tv_watch` hydration.
 */
export function TvDetailClientRoot({
	tvId,
	title,
	posterUrl,
	averageRating,
	children,
}: {
	tvId: number;
	title: string;
	posterUrl?: string | null;
	averageRating?: number | null;
	children: ReactNode;
}) {
	return (
		<TvDetailWatchProvider
			tvId={tvId}
			title={title}
			posterUrl={posterUrl}
			averageRating={averageRating}
		>
			{children}
		</TvDetailWatchProvider>
	);
}
