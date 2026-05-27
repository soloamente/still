"use client";

import { createContext, type ReactNode, useContext } from "react";

import { useTvDetailUserState } from "@/components/tv/use-tv-detail-user-state";
import { useTvWatch } from "@/components/tv/use-tv-watch";

type TvDetailWatchContextValue = {
	tvId: number;
	title: string;
	tvWatch: ReturnType<typeof useTvWatch>;
	userState: ReturnType<typeof useTvDetailUserState>;
};

const TvDetailWatchContext = createContext<TvDetailWatchContextValue | null>(
	null,
);

/** Single hydration point for TV detail diary + progress (avoids duplicate fetches). */
export function TvDetailWatchProvider({
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
	const tvWatch = useTvWatch(tvId);
	const userState = useTvDetailUserState(tvId, title, {
		posterUrl,
		averageRating,
	});

	return (
		<TvDetailWatchContext.Provider value={{ tvId, title, tvWatch, userState }}>
			{children}
		</TvDetailWatchContext.Provider>
	);
}

export function useTvDetailWatchContext() {
	const ctx = useContext(TvDetailWatchContext);
	if (!ctx) {
		throw new Error(
			"useTvDetailWatchContext must be used within TvDetailWatchProvider",
		);
	}
	return ctx;
}
