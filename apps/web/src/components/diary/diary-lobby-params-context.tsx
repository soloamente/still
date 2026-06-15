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
	type DiaryWatchPeriods,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
	parseDiaryWatchDecade,
	parseDiaryWatchYear,
	resolveDiaryLedgerTab,
} from "@/lib/diary-lobby-order";
import type { HomeVenue } from "@/lib/home-venue";

interface DiaryLobbySnapshot {
	order: DiaryLobbyOrder;
	venue: HomeVenue;
	ledgerTab: DiaryLedgerTabId;
	year: number | null;
	decade: number | null;
}

interface DiaryLobbyParamsContextValue extends DiaryLobbySnapshot {
	watchPeriods: DiaryWatchPeriods;
	selectOrder: (order: DiaryLobbyOrder) => void;
	selectVenue: (venue: HomeVenue) => void;
	selectTab: (tab: DiaryLedgerTabId) => void;
	selectYear: (year: number) => void;
	selectDecade: (decade: number) => void;
	clearWatchPeriod: () => void;
}

const DiaryLobbyParamsContext =
	createContext<DiaryLobbyParamsContextValue | null>(null);

const EMPTY_WATCH_PERIODS: DiaryWatchPeriods = { years: [], decades: [] };

function snapshotFromSearchParams(
	searchParams: URLSearchParams,
	movieCount: number,
	tvCount: number,
): DiaryLobbySnapshot {
	const year = parseDiaryWatchYear(searchParams.get("year"));
	const decade =
		year != null ? null : parseDiaryWatchDecade(searchParams.get("decade"));
	return {
		order: parseDiaryLobbyOrder(searchParams.get("order")),
		venue: parseDiaryLobbyVenue(searchParams.get("venue")),
		ledgerTab: resolveDiaryLedgerTab(
			searchParams.get("tab"),
			movieCount,
			tvCount,
		),
		year,
		decade,
	};
}

export function DiaryLobbyParamsProvider({
	movieCount,
	tvCount,
	watchPeriods = EMPTY_WATCH_PERIODS,
	children,
}: {
	/** Listed diary rows with a movie join — drives default `?tab=`. */
	movieCount: number;
	/** Listed diary rows with a TV join — drives default `?tab=`. */
	tvCount: number;
	/** Distinct watch years/decades for period chips (RSC seed per tab). */
	watchPeriods?: DiaryWatchPeriods;
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
			pending.ledgerTab === urlState.ledgerTab &&
			pending.year === urlState.year &&
			pending.decade === urlState.decade
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
					year: next.year,
					decade: next.decade,
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

	const selectYear = useCallback(
		(year: number) => {
			applySnapshot({ ...active, year, decade: null });
		},
		[active, applySnapshot],
	);

	const selectDecade = useCallback(
		(decade: number) => {
			applySnapshot({ ...active, decade, year: null });
		},
		[active, applySnapshot],
	);

	const clearWatchPeriod = useCallback(() => {
		applySnapshot({ ...active, year: null, decade: null });
	}, [active, applySnapshot]);

	const value = useMemo(
		(): DiaryLobbyParamsContextValue => ({
			order: active.order,
			venue: active.venue,
			ledgerTab: active.ledgerTab,
			year: active.year,
			decade: active.decade,
			watchPeriods,
			selectOrder,
			selectVenue,
			selectTab,
			selectYear,
			selectDecade,
			clearWatchPeriod,
		}),
		[
			active,
			watchPeriods,
			selectOrder,
			selectVenue,
			selectTab,
			selectYear,
			selectDecade,
			clearWatchPeriod,
		],
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
