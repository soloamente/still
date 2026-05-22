"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

import { writeHomeLobbyHrefCookie } from "@/lib/home-lobby-cookie";
import {
	buildHomeHrefFromPersisted,
	readHomeLobbyPersisted,
	readLastHomeBrowseSurface,
} from "@/lib/home-lobby-persist";

/**
 * When the patron lands on a **bare** `/home` (no query), sync the address bar to their
 * last lobby chips without `router.replace` — that path triggers Next 307 redirects in dev.
 * The RSC page already reads the same prefs from the `still.home-lobby-href-v1` cookie.
 */
export function HomeLobbySessionRestore() {
	const pathname = usePathname();

	useLayoutEffect(() => {
		if (pathname !== "/home") return;
		const search = window.location.search;
		const isBare = search === "" || search === "?";
		if (!isBare) return;
		const persisted = readHomeLobbyPersisted();
		if (!persisted) return;
		const surface = readLastHomeBrowseSurface();
		const href = buildHomeHrefFromPersisted(persisted, surface);
		if (href === "/home") return;
		const current = `${pathname}${search}`;
		if (href === current) return;
		// URL-only update — no RSC round-trip, no 307.
		window.history.replaceState(null, "", href);
		writeHomeLobbyHrefCookie(href);
	}, [pathname]);

	return null;
}
