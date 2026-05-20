"use client";

import { useEffect, useState } from "react";

import {
	type MovieDetailReturn,
	resolveMovieDetailReturn,
} from "@/lib/movie-detail-return";

/** Hydrates film-detail back link from referrer + persisted home browse rail. */
export function useMovieDetailReturn(): MovieDetailReturn {
	const [back, setBack] = useState<MovieDetailReturn>({
		href: "/home",
		label: "Movies",
	});

	useEffect(() => {
		setBack(resolveMovieDetailReturn());
	}, []);

	return back;
}
