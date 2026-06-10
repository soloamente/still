"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
	MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	type MovieDetailReturn,
	resolveProfileReturn,
} from "@/lib/movie-detail-return";

/** Hydrates profile back link — avoids self-loop to the same `/profile/[handle]`. */
export function useProfileReturn(): MovieDetailReturn {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const searchSuffix = useMemo(() => {
		const search = searchParams.toString();
		return search.length > 0 ? `?${search}` : "";
	}, [searchParams]);

	// Keep first paint aligned with SSR — resolveProfileReturn reads sessionStorage.
	const [back, setBack] = useState<MovieDetailReturn>(
		MOVIE_DETAIL_RETURN_SSR_FALLBACK,
	);

	useEffect(() => {
		setBack(resolveProfileReturn(pathname, searchSuffix));
	}, [pathname, searchSuffix]);

	return back;
}
