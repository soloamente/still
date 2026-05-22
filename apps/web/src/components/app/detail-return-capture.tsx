"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
	isListingDetailPath,
	persistMovieDetailReturn,
} from "@/lib/movie-detail-return";

/**
 * Remembers the last non-detail route before film/TV detail opens.
 * Next.js client navigations do not update `document.referrer`, so the back pill
 * reads this session snapshot in `resolveMovieDetailReturn`.
 */
export function DetailReturnCapture() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const previousRef = useRef<{ pathname: string; search: string }>({
		pathname: "",
		search: "",
	});

	useEffect(() => {
		const search = searchParams.toString();
		const searchSuffix = search.length > 0 ? `?${search}` : "";
		const previous = previousRef.current;

		if (
			isListingDetailPath(pathname) &&
			!isListingDetailPath(previous.pathname)
		) {
			persistMovieDetailReturn(previous.pathname, previous.search);
		}

		previousRef.current = { pathname, search: searchSuffix };
	}, [pathname, searchParams]);

	return null;
}
