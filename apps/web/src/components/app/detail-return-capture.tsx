"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
	isListingDetailPath,
	isMeSettingsPath,
	isProfileLobbyPath,
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

		const enteringListingDetail =
			isListingDetailPath(pathname) && !isListingDetailPath(previous.pathname);
		const enteringProfileLobby =
			isProfileLobbyPath(pathname) &&
			previous.pathname.length > 0 &&
			!isProfileLobbyPath(previous.pathname);
		const enteringSettings =
			isMeSettingsPath(pathname) &&
			previous.pathname.length > 0 &&
			!isMeSettingsPath(previous.pathname);

		// Remember the prior route for detail, profile, and settings back pills.
		if (enteringListingDetail || enteringProfileLobby || enteringSettings) {
			persistMovieDetailReturn(previous.pathname, previous.search);
		}

		previousRef.current = { pathname, search: searchSuffix };
	}, [pathname, searchParams]);

	return null;
}
