"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

export type HomeTasteHeroTrailerState = {
	/** YouTube/Vimeo background embed URL for the lobby card. */
	src: string;
	/** Spotlight TMDb id — remount iframe when the hero swaps titles. */
	tmdbId: number;
} | null;

type HomeTasteHeroTrailerContextValue = {
	trailer: HomeTasteHeroTrailerState;
	setTrailer: (trailer: HomeTasteHeroTrailerState) => void;
};

const HomeTasteHeroTrailerContext =
	createContext<HomeTasteHeroTrailerContextValue | null>(null);

/** Shares taste-hero trailer state between the spotlight card and the lobby shell. */
export function HomeTasteHeroTrailerProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [trailer, setTrailerState] = useState<HomeTasteHeroTrailerState>(null);

	const setTrailer = useCallback((next: HomeTasteHeroTrailerState) => {
		setTrailerState(next);
	}, []);

	const value = useMemo(() => ({ trailer, setTrailer }), [setTrailer, trailer]);

	return (
		<HomeTasteHeroTrailerContext.Provider value={value}>
			{children}
		</HomeTasteHeroTrailerContext.Provider>
	);
}

export function useHomeTasteHeroTrailer() {
	const ctx = useContext(HomeTasteHeroTrailerContext);
	if (!ctx) {
		throw new Error(
			"useHomeTasteHeroTrailer must be used within HomeTasteHeroTrailerProvider",
		);
	}
	return ctx;
}
