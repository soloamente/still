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
import {
	buildDiaryLobbyHref,
	type DiaryLedgerTabId,
	type DiaryLobbyOrder,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
	resolveDiaryLedgerTab,
} from "@/lib/diary-lobby-order";
import type { HomeVenue } from "@/lib/home-venue";

interface DiaryLobbySnapshot {
	order: DiaryLobbyOrder;
	venue: HomeVenue;
	ledgerTab: DiaryLedgerTabId;
}

interface DiaryLobbyParamsContextValue extends DiaryLobbySnapshot {
	selectOrder: (order: DiaryLobbyOrder) => void;
	selectVenue: (venue: HomeVenue) => void;
	selectTab: (tab: DiaryLedgerTabId) => void;
}

const DiaryLobbyParamsContext =
	createContext<DiaryLobbyParamsContextValue | null>(null);

function snapshotFromSearchParams(
	searchParams: URLSearchParams,
	movieCount: number,
	tvCount: number,
): DiaryLobbySnapshot {
	return {
		order: parseDiaryLobbyOrder(searchParams.get("order")),
		venue: parseDiaryLobbyVenue(searchParams.get("venue")),
		ledgerTab: resolveDiaryLedgerTab(
			searchParams.get("tab"),
			movieCount,
			tvCount,
		),
	};
}

export function DiaryLobbyParamsProvider({
	movieCount,
	tvCount,
	children,
}: {
	/** Listed diary rows with a movie join — drives default `?tab=`. */
	movieCount: number;
	/** Listed diary rows with a TV join — drives default `?tab=`. */
	tvCount: number;
	children: ReactNode;
}) {
	const searchParams = useSearchParams();
	const { navigate } = useLobbyNavigation();

	const urlState = useMemo(
		() =>
			snapshotFromSearchParams(
				new URLSearchParams(searchParams.toString()),
				movieCount,
				tvCount,
			),
		[searchParams, movieCount, tvCount],
	);

	const [pending, setPending] = useState<DiaryLobbySnapshot | null>(null);

	useEffect(() => {
		if (pending == null) return;
		if (
			pending.order === urlState.order &&
			pending.venue === urlState.venue &&
			pending.ledgerTab === urlState.ledgerTab
		) {
			setPending(null);
		}
	}, [pending, urlState]);

	const active = pending ?? urlState;

	const applySnapshot = useCallback(
		(next: DiaryLobbySnapshot) => {
			setPending(next);
			navigate(
				buildDiaryLobbyHref({
					order: next.order,
					venue: next.venue,
					tab: next.ledgerTab,
				}),
			);
		},
		[navigate],
	);

	const selectOrder = useCallback(
		(order: DiaryLobbyOrder) => {
			applySnapshot({ ...active, order });
		},
		[active, applySnapshot],
	);

	const selectVenue = useCallback(
		(venue: HomeVenue) => {
			applySnapshot({ ...active, venue });
		},
		[active, applySnapshot],
	);

	const selectTab = useCallback(
		(tab: DiaryLedgerTabId) => {
			applySnapshot({ ...active, ledgerTab: tab });
		},
		[active, applySnapshot],
	);

	const value = useMemo(
		(): DiaryLobbyParamsContextValue => ({
			order: active.order,
			venue: active.venue,
			ledgerTab: active.ledgerTab,
			selectOrder,
			selectVenue,
			selectTab,
		}),
		[active, selectOrder, selectVenue, selectTab],
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
