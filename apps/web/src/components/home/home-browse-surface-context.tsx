"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import {
	type HomeBrowseSurface,
	parseHomeBrowseSurface,
} from "@/lib/home-browse-surface";
import { buildBrowseSurfaceNavigateHref } from "@/lib/home-browse-surface-nav";
import { HOME_CATALOGUE_SEARCH_PARAM } from "@/lib/home-catalogue-search-param";

interface HomeBrowseSurfaceContextValue {
	/** Optimistic or settled browse rail — drives the sliding pill. */
	activeBrowse: HomeBrowseSurface;
	/** Browse rail from the URL (post-navigation). */
	urlBrowse: HomeBrowseSurface;
	selectBrowseSurface: (next: HomeBrowseSurface) => void;
	prefetchBrowseSurface: (next: HomeBrowseSurface) => void;
}

const HomeBrowseSurfaceContext =
	createContext<HomeBrowseSurfaceContextValue | null>(null);

export function HomeBrowseSurfaceProvider({
	children,
}: {
	children: ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { navigate } = useLobbyNavigation();
	const isHomeLobby = pathname === "/home" || pathname.startsWith("/home/");
	const urlBrowse = parseHomeBrowseSurface(searchParams.get("browse"));
	const [pendingBrowse, setPendingBrowse] = useState<HomeBrowseSurface | null>(
		null,
	);

	useEffect(() => {
		if (pendingBrowse != null && pendingBrowse === urlBrowse) {
			setPendingBrowse(null);
		}
	}, [pendingBrowse, urlBrowse]);

	const activeBrowse = pendingBrowse ?? urlBrowse;

	const selectBrowseSurface = useCallback(
		(next: HomeBrowseSurface) => {
			const href = buildBrowseSurfaceNavigateHref(next, {
				isHomeLobby,
				currentParams: new URLSearchParams(searchParams.toString()),
			});

			if (!isHomeLobby) {
				// Cross-route (/diary → /home) — push, not replace.
				router.push(href);
				return;
			}

			if (
				next === activeBrowse &&
				pendingBrowse == null &&
				!searchParams.get(HOME_CATALOGUE_SEARCH_PARAM)?.trim()
			) {
				return;
			}

			setPendingBrowse(next);
			navigate(href);
		},
		[activeBrowse, isHomeLobby, navigate, pendingBrowse, router, searchParams],
	);

	const prefetchBrowseSurface = useCallback(
		(next: HomeBrowseSurface) => {
			if (!isHomeLobby) return;
			const href = buildBrowseSurfaceNavigateHref(next, {
				isHomeLobby: true,
				currentParams: new URLSearchParams(searchParams.toString()),
			});
			router.prefetch(href);
		},
		[isHomeLobby, router, searchParams],
	);

	// Warm Community RSC while the patron is still on Movies/TV — skip when already there.
	useEffect(() => {
		if (!isHomeLobby || urlBrowse === "community") return;

		const idleWindow = window as Window & {
			requestIdleCallback?: (
				callback: () => void,
				options?: { timeout?: number },
			) => number;
			cancelIdleCallback?: (id: number) => void;
		};

		const runPrefetch = () => prefetchBrowseSurface("community");

		if (typeof idleWindow.requestIdleCallback === "function") {
			const idleId = idleWindow.requestIdleCallback(runPrefetch, {
				timeout: 4000,
			});
			return () => idleWindow.cancelIdleCallback?.(idleId);
		}

		const timeoutId = window.setTimeout(runPrefetch, 1500);
		return () => window.clearTimeout(timeoutId);
	}, [isHomeLobby, urlBrowse, prefetchBrowseSurface]);

	const value = useMemo(
		(): HomeBrowseSurfaceContextValue => ({
			activeBrowse,
			urlBrowse,
			selectBrowseSurface,
			prefetchBrowseSurface,
		}),
		[activeBrowse, urlBrowse, selectBrowseSurface, prefetchBrowseSurface],
	);

	return (
		<HomeBrowseSurfaceContext.Provider value={value}>
			{children}
		</HomeBrowseSurfaceContext.Provider>
	);
}

export function useHomeBrowseSurface(): HomeBrowseSurfaceContextValue {
	const ctx = useContext(HomeBrowseSurfaceContext);
	if (ctx == null) {
		throw new Error(
			"useHomeBrowseSurface must be used within HomeBrowseSurfaceProvider",
		);
	}
	return ctx;
}

/** Diary/lists/watchlist chrome — falls back to legacy `router.push` when outside `/home` root. */
export function useHomeBrowseSurfaceOptional(): HomeBrowseSurfaceContextValue | null {
	return useContext(HomeBrowseSurfaceContext);
}
