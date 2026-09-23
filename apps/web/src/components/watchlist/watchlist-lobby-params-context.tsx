"use client";

import { useSearchParams } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
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

interface WatchlistLobbyParamsContextValue {
	order: WatchlistLobbyOrder;
	/** RSC seed sort currently mounted in the poster wall — null before first report. */
	seedOrder: WatchlistLobbyOrder | null;
	/** Total saves for the mounted grid — null until the catalogue reports page 1. */
	gridTotalResults: number | null;
	selectOrder: (order: WatchlistLobbyOrder) => void;
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
	const orderState = useOptimisticLobbyParam(urlOrder);
	const [seedOrder, setSeedOrder] = useState<WatchlistLobbyOrder | null>(null);
	const [gridTotalResults, setGridTotalResults] = useState<number | null>(null);

	const selectOrder = useCallback(
		(order: WatchlistLobbyOrder) => {
			orderState.setOptimistic(order);
			// Drop the count until the new mode's RSC reports — avoids stale "N saves".
			setGridTotalResults(null);
			navigate(buildWatchlistLobbyHref({ order }));
		},
		[navigate, orderState],
	);

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
			seedOrder,
			gridTotalResults,
			selectOrder,
			reportSeedOrder,
			reportGridTotalResults,
		}),
		[
			orderState.value,
			gridTotalResults,
			reportSeedOrder,
			reportGridTotalResults,
			seedOrder,
			selectOrder,
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
