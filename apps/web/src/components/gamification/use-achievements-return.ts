"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
	MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	type MovieDetailReturn,
	resolveAchievementsReturn,
} from "@/lib/movie-detail-return";

/** Hydrates achievements back link — avoids self-loop to `/achievements`. */
export function useAchievementsReturn(): MovieDetailReturn {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const searchSuffix = useMemo(() => {
		const search = searchParams.toString();
		return search.length > 0 ? `?${search}` : "";
	}, [searchParams]);

	const [back, setBack] = useState<MovieDetailReturn>(
		MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	);

	useEffect(() => {
		setBack(resolveAchievementsReturn(pathname, searchSuffix));
	}, [pathname, searchSuffix]);

	return back;
}
