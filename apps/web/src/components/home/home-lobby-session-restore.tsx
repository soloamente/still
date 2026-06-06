"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import { writeHomeLobbyHrefCookie } from "@/lib/home-lobby-cookie";
import {
	buildHomeHrefFromPersisted,
	readHomeLobbyPersisted,
	readLastHomeBrowseSurface,
} from "@/lib/home-lobby-persist";

/**
 * When the patron lands on a **bare** `/home` (no query), navigate to their last lobby
 * chips so the RSC payload matches the restored URL. Cookie restore covers many cases on
 * the server; this path handles localStorage-only prefs and keeps the address bar honest.
 */
export function HomeLobbySessionRestore() {
	const pathname = usePathname();
	const { navigate } = useLobbyNavigation();

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
		writeHomeLobbyHrefCookie(href);
		navigate(href);
	}, [navigate, pathname]);

	return null;
}
