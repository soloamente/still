"use client";

import { useSearchParams } from "next/navigation";
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
import { useOptimisticLobbyParam } from "@/lib/use-optimistic-lobby-param";
import {
	buildWatchlistLobbyHref,
	parseWatchlistLobbyOrder,
	type WatchlistLobbyOrder,
} from "@/lib/watchlist-lobby-order";
import {
	parseWatchlistProviderIds,
	watchlistProviderIdsEqual,
} from "@/lib/watchlist-provider-filter";

interface WatchlistLobbyParamsContextValue {
	order: WatchlistLobbyOrder;
	/** Active AND streaming filter from `?providers=` (optimistic while navigating). */
	providers: readonly number[];
	/** RSC seed sort currently mounted in the poster wall — null before first report. */
	seedOrder: WatchlistLobbyOrder | null;
	/** Total saves for the mounted grid — null until the catalogue reports page 1. */
	gridTotalResults: number | null;
	selectOrder: (order: WatchlistLobbyOrder) => void;
	selectProvider: (
		providerId: number,
		options?: { deferNavigate?: boolean },
	) => void;
	removeProvider: (providerId: number) => void;
	clearProviders: () => void;
	/** Push `?providers=` to the URL (after fly/resize — avoids jank mid-transition). */
	commitProvidersNavigate: () => void;
	reportSeedOrder: (order: WatchlistLobbyOrder) => void;
	reportGridTotalResults: (
		order: WatchlistLobbyOrder,
		totalResults: number,
	) => void;
}

const WatchlistLobbyParamsContext =
	createContext<WatchlistLobbyParamsContextValue | null>(null);

export function WatchlistLobbyParamsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const searchParams = useSearchParams();
	const { navigate } = useLobbyNavigation();
	const urlOrder = parseWatchlistLobbyOrder(searchParams.get("order"));
	const urlProviders = parseWatchlistProviderIds(searchParams.get("providers"));
	const orderState = useOptimisticLobbyParam(urlOrder);
	const [providerOverride, setProviderOverride] = useState<number[] | null>(
		null,
	);
	const providers = providerOverride ?? urlProviders;
	const [seedOrder, setSeedOrder] = useState<WatchlistLobbyOrder | null>(null);
	const [gridTotalResults, setGridTotalResults] = useState<number | null>(null);

	useEffect(() => {
		if (
			providerOverride !== null &&
			watchlistProviderIdsEqual(providerOverride, urlProviders)
		) {
			setProviderOverride(null);
		}
	}, [providerOverride, urlProviders]);

	const pushProviders = useCallback(
		(next: readonly number[], options?: { deferNavigate?: boolean }) => {
			setProviderOverride([...next]);
			if (options?.deferNavigate) return;
			setGridTotalResults(null);
			navigate(
				buildWatchlistLobbyHref({
					order: orderState.value,
					providers: next,
				}),
			);
		},
		[navigate, orderState.value],
	);

	const commitProvidersNavigate = useCallback(() => {
		const next = providerOverride ?? urlProviders;
		setGridTotalResults(null);
		navigate(
			buildWatchlistLobbyHref({
				order: orderState.value,
				providers: next,
			}),
		);
	}, [navigate, orderState.value, providerOverride, urlProviders]);

	const selectOrder = useCallback(
		(order: WatchlistLobbyOrder) => {
			orderState.setOptimistic(order);
			// Drop the count until the new mode's RSC reports — avoids stale "N saves".
			setGridTotalResults(null);
			navigate(buildWatchlistLobbyHref({ order, providers }));
		},
		[navigate, orderState, providers],
	);

	const selectProvider = useCallback(
		(providerId: number, options?: { deferNavigate?: boolean }) => {
			if (providers.includes(providerId)) return;
			const next = [...providers, providerId].sort((a, b) => a - b);
			pushProviders(next, options);
		},
		[providers, pushProviders],
	);

	const removeProvider = useCallback(
		(providerId: number) => {
			pushProviders(providers.filter((id) => id !== providerId));
		},
		[providers, pushProviders],
	);

	const clearProviders = useCallback(() => {
		pushProviders([]);
	}, [pushProviders]);

	const reportSeedOrder = useCallback((order: WatchlistLobbyOrder) => {
		setSeedOrder((prev) => (prev === order ? prev : order));
	}, []);

	const reportGridTotalResults = useCallback(
		(_order: WatchlistLobbyOrder, totalResults: number) => {
			setGridTotalResults((prev) =>
				prev === totalResults ? prev : totalResults,
			);
		},
		[],
	);

	const value = useMemo(
		() => ({
			order: orderState.value,
			providers,
			seedOrder,
			gridTotalResults,
			selectOrder,
			selectProvider,
			removeProvider,
			clearProviders,
			commitProvidersNavigate,
			reportSeedOrder,
			reportGridTotalResults,
		}),
		[
			orderState.value,
			providers,
			gridTotalResults,
			reportSeedOrder,
			reportGridTotalResults,
			seedOrder,
			selectOrder,
			selectProvider,
			removeProvider,
			clearProviders,
			commitProvidersNavigate,
		],
	);

	return (
		<WatchlistLobbyParamsContext.Provider value={value}>
			{children}
		</WatchlistLobbyParamsContext.Provider>
	);
}

export function useWatchlistLobbyParams(): WatchlistLobbyParamsContextValue {
	const ctx = useContext(WatchlistLobbyParamsContext);
	if (ctx == null) {
		throw new Error(
			"useWatchlistLobbyParams must be used within WatchlistLobbyParamsProvider",
		);
	}
	return ctx;
}
