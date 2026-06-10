"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
	MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	type MovieDetailReturn,
	resolveSettingsReturn,
} from "@/lib/movie-detail-return";

/** Hydrates settings back link from the route before `/me/settings/*`. */
export function useSettingsReturn(): MovieDetailReturn {
	const pathname = usePathname();

	// Keep first paint aligned with SSR — resolveSettingsReturn reads sessionStorage.
	const [back, setBack] = useState<MovieDetailReturn>(
		MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	);

	useEffect(() => {
		setBack(resolveSettingsReturn(pathname));
	}, [pathname]);

	return back;
}
