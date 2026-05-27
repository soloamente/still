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
import {
	buildDiaryLobbyHref,
	type DiaryLobbyOrder,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
} from "@/lib/diary-lobby-order";
import type { HomeVenue } from "@/lib/home-venue";
import { useOptimisticLobbyParam } from "@/lib/use-optimistic-lobby-param";

interface DiaryLobbyParamsContextValue {
	order: DiaryLobbyOrder;
	venue: HomeVenue;
	selectOrder: (order: DiaryLobbyOrder) => void;
	selectVenue: (venue: HomeVenue) => void;
}

const DiaryLobbyParamsContext =
	createContext<DiaryLobbyParamsContextValue | null>(null);

export function DiaryLobbyParamsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const searchParams = useSearchParams();
	const { navigate } = useLobbyNavigation();
	const urlOrder = parseDiaryLobbyOrder(searchParams.get("order"));
	const urlVenue = parseDiaryLobbyVenue(searchParams.get("venue"));
	const orderState = useOptimisticLobbyParam(urlOrder);
	const venueState = useOptimisticLobbyParam(urlVenue);

	const selectOrder = useCallback(
		(order: DiaryLobbyOrder) => {
			orderState.setOptimistic(order);
			navigate(buildDiaryLobbyHref({ order, venue: venueState.value }));
		},
		[navigate, orderState.setOptimistic, venueState.value],
	);

	const selectVenue = useCallback(
		(venue: HomeVenue) => {
			venueState.setOptimistic(venue);
			navigate(buildDiaryLobbyHref({ order: orderState.value, venue }));
		},
		[navigate, orderState.value, venueState.setOptimistic],
	);

	const value = useMemo(
		() => ({
			order: orderState.value,
			venue: venueState.value,
			selectOrder,
			selectVenue,
		}),
		[orderState.value, venueState.value, selectOrder, selectVenue],
	);

	return (
		<DiaryLobbyParamsContext.Provider value={value}>
			{children}
		</DiaryLobbyParamsContext.Provider>
	);
}

export function useDiaryLobbyParams(): DiaryLobbyParamsContextValue {
	const ctx = useContext(DiaryLobbyParamsContext);
	if (ctx == null) {
		throw new Error(
			"useDiaryLobbyParams must be used within DiaryLobbyParamsProvider",
		);
	}
	return ctx;
}
