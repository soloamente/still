"use client";

import { useEffect, useState } from "react";

import {
	MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	type MovieDetailReturn,
	resolveMovieDetailReturn,
} from "@/lib/movie-detail-return";

/** Hydrates film-detail back link from referrer + persisted home browse rail. */
export function useMovieDetailReturn(): MovieDetailReturn {
	const [back, setBack] = useState<MovieDetailReturn>(
		MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	);

	useEffect(() => {
		setBack(resolveMovieDetailReturn());
	}, []);

	return back;
}
