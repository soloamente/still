"use client";

import { useSearchParams } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
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
	selectOrder: (order: WatchlistLobbyOrder) => void;
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

	const selectOrder = useCallback(
		(order: WatchlistLobbyOrder) => {
			orderState.setOptimistic(order);
			navigate(buildWatchlistLobbyHref({ order }));
		},
		[navigate, orderState],
	);

	const value = useMemo(
		() => ({
			order: orderState.value,
			selectOrder,
		}),
		[orderState.value, selectOrder],
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
