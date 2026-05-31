"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
import { parseHomeAnimeSeason } from "@/lib/home-anime-season";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	type HomeCatalogRun,
	parseHomeCatalogRun,
} from "@/lib/home-catalog-run";
import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import {
	type HomeVenue,
	parseHomeVenue,
	parseTvLobbyVenue,
} from "@/lib/home-venue";

interface HomeTmdbLobbySnapshot {
	browse: "movies" | "tv";
	sort: HomeCatalogSort;
	venue: HomeVenue;
	run: HomeCatalogRun | null;
	animeSeason: boolean;
}

interface HomeTmdbLobbyParamsContextValue extends HomeTmdbLobbySnapshot {
	selectSort: (sort: HomeCatalogSort) => void;
	selectVenue: (venue: HomeVenue) => void;
	/** TV lifecycle chips — toggles off when the same run is tapped again. */
	selectRun: (run: HomeCatalogRun) => void;
	/** TV seasonal anime slice — mutually exclusive with `run` chips. */
	selectAnimeSeason: () => void;
	prefetchLobby: (href: string) => void;
}

const HomeTmdbLobbyParamsContext =
	createContext<HomeTmdbLobbyParamsContextValue | null>(null);

function snapshotFromSearchParams(
	searchParams: URLSearchParams,
): HomeTmdbLobbySnapshot {
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const browseTmdb = browse === "tv" ? "tv" : "movies";
	const sortParam = searchParams.get("sort")?.trim().toLowerCase() ?? "";
	const catalogRun =
		parseHomeCatalogRun(searchParams.get("run"), browse) ??
		(browse === "tv" &&
		(sortParam === "ongoing" ||
			sortParam === "on-air" ||
			sortParam === "on_the_air")
			? "ongoing"
			: browse === "tv" &&
					(sortParam === "upcoming" ||
						sortParam === "coming" ||
						sortParam === "soon")
				? "upcoming"
				: null);
	const sort = parseHomeCatalogSort(searchParams.get("sort"), browse);
	const venue =
		browseTmdb === "tv"
			? parseTvLobbyVenue(searchParams.get("venue"), sort, catalogRun)
			: parseHomeVenue(searchParams.get("venue"), sort);
	const animeSeason =
		browseTmdb === "tv" &&
		parseHomeAnimeSeason(searchParams.get("animeSeason"));

	return {
		browse: browseTmdb,
		sort,
		venue,
		run: animeSeason ? null : catalogRun,
		animeSeason,
	};
}

function lobbyHref(snapshot: HomeTmdbLobbySnapshot): string {
	return buildHomeLobbyHref({
		browse: snapshot.browse,
		sort: snapshot.sort,
		venue: snapshot.venue,
		run: snapshot.animeSeason ? null : snapshot.run,
		animeSeason: snapshot.animeSeason,
	});
}

export function HomeTmdbLobbyParamsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { navigate } = useLobbyNavigation();

	const urlState = useMemo(
		() =>
			snapshotFromSearchParams(new URLSearchParams(searchParams.toString())),
		[searchParams],
	);

	const [pending, setPending] = useState<HomeTmdbLobbySnapshot | null>(null);

	useEffect(() => {
		if (pending == null) return;
		if (
			pending.browse === urlState.browse &&
			pending.sort === urlState.sort &&
			pending.venue === urlState.venue &&
			pending.run === urlState.run &&
			pending.animeSeason === urlState.animeSeason
		) {
			setPending(null);
		}
	}, [pending, urlState]);

	const active = pending ?? urlState;

	const navigateLobby = useCallback(
		(patch: Partial<HomeTmdbLobbySnapshot>) => {
			const next: HomeTmdbLobbySnapshot = { ...active, ...patch };
			setPending(next);
			navigate(lobbyHref(next));
		},
		[active, navigate],
	);

	const selectSort = useCallback(
		(sort: HomeCatalogSort) => {
			navigateLobby({ sort });
		},
		[navigateLobby],
	);

	const selectVenue = useCallback(
		(venue: HomeVenue) => {
			navigateLobby({ venue });
		},
		[navigateLobby],
	);

	const selectRun = useCallback(
		(run: HomeCatalogRun) => {
			const nextRun = active.run === run ? null : run;
			navigateLobby({ run: nextRun, animeSeason: false });
		},
		[active, navigateLobby],
	);

	const selectAnimeSeason = useCallback(() => {
		navigateLobby({
			animeSeason: !active.animeSeason,
			run: null,
		});
	}, [active.animeSeason, navigateLobby]);

	const prefetchLobby = useCallback(
		(href: string) => {
			router.prefetch(href);
		},
		[router],
	);

	const value = useMemo(
		(): HomeTmdbLobbyParamsContextValue => ({
			...active,
			selectSort,
			selectVenue,
			selectRun,
			selectAnimeSeason,
			prefetchLobby,
		}),
		[
			active,
			selectSort,
			selectVenue,
			selectRun,
			selectAnimeSeason,
			prefetchLobby,
		],
	);

	return (
		<HomeTmdbLobbyParamsContext.Provider value={value}>
			{children}
		</HomeTmdbLobbyParamsContext.Provider>
	);
}

export function useHomeTmdbLobbyParams(): HomeTmdbLobbyParamsContextValue {
	const ctx = useContext(HomeTmdbLobbyParamsContext);
	if (ctx == null) {
		throw new Error(
			"useHomeTmdbLobbyParams must be used within HomeTmdbLobbyParamsProvider",
		);
	}
	return ctx;
}

/** Diary / watchlist toolbars keep `<Link>` — only `/home` Movies·TV mounts the provider. */
export function useHomeTmdbLobbyParamsOptional(): HomeTmdbLobbyParamsContextValue | null {
	return useContext(HomeTmdbLobbyParamsContext);
}
