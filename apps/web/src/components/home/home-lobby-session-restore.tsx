"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect } from "react";

import {
	buildHomeHrefFromPersisted,
	readHomeLobbyPersisted,
} from "@/lib/home-lobby-persist";

/**
 * When the patron lands on a **bare** `/home` (no query), restore their last Movies-lobby
 * chips from localStorage so the sort pill + venue match the previous session after
 * visiting diary, watchlist, or other routes that dropped `?sort=` / `?venue=`.
 */
export function HomeLobbySessionRestore() {
	const pathname = usePathname();
	const router = useRouter();

	useLayoutEffect(() => {
		if (pathname !== "/home") return;
		const search = window.location.search;
		const isBare = search === "" || search === "?";
		if (!isBare) return;
		const persisted = readHomeLobbyPersisted();
		if (!persisted) return;
		const href = buildHomeHrefFromPersisted(persisted, "movies");
		if (href === "/home") return;
		router.replace(href);
	}, [pathname, router]);

	return null;
}
