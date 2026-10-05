"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import { WATCHLIST_PILL_NAVIGATE_DEFER_MS } from "@/lib/watchlist-provider-pill-motion";
import {
	WATCHLIST_ROW_LOGO_SIZE_PX,
	watchlistNextPillLogoLandingRect,
} from "@/lib/watchlist-provider-pill-stack-geometry";

export type WatchlistProviderFlyVisual = {
	src: string | null;
	name: string;
	fallbackLabel?: string;
};

export type ActiveFly = WatchlistProviderFlyVisual & {
	providerId: number;
	from: DOMRect;
	to: DOMRect;
	toMeasured: boolean;
};

/** Pill width beside filters — compact logo dock vs full label. */
export type WatchlistPillDockPhase = "compact" | "expanded";

interface WatchlistProviderFlyChromeContextValue {
	landingProviderIds: ReadonlySet<number>;
	pillDockPhase: WatchlistPillDockPhase;
	/** Increments on every fly landing — drives shell bounce in the filter pill. */
	pillLandBounceKey: number;
	flyProviderToFilter: (
		providerId: number,
		fromRect: DOMRect,
		visual: WatchlistProviderFlyVisual,
	) => Promise<void>;
}

interface WatchlistProviderFlyMotionContextValue {
	activeFly: ActiveFly | null;
	completeFly: (
		providerId: number,
		options?: { syncNavigateImmediately?: boolean },
	) => void;
	markFlyTargetMeasured: (providerId: number, to: DOMRect) => void;
}

const WatchlistProviderFlyChromeContext =
	createContext<WatchlistProviderFlyChromeContextValue | null>(null);

const WatchlistProviderFlyMotionContext =
	createContext<WatchlistProviderFlyMotionContextValue | null>(null);

export function WatchlistProviderFlyProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { providers, selectProvider, commitProvidersNavigate } =
		useWatchlistLobbyParams();
	const [landingProviderIds, setLandingProviderIds] = useState<Set<number>>(
		() => new Set(),
	);
	const [pillDockPhase, setPillDockPhase] =
		useState<WatchlistPillDockPhase>("expanded");
	const [pillLandBounceKey, setPillLandBounceKey] = useState(0);
	const [activeFly, setActiveFly] = useState<ActiveFly | null>(null);
	const completeResolversRef = useRef<Map<number, () => void>>(new Map());
	const commitNavigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	useEffect(() => {
		if (providers.length === 0) {
			setPillDockPhase("expanded");
			setPillLandBounceKey(0);
		}
		return () => {
			if (commitNavigateTimeoutRef.current != null) {
				clearTimeout(commitNavigateTimeoutRef.current);
			}
		};
	}, [providers.length]);

	const markFlyTargetMeasured = useCallback(
		(providerId: number, to: DOMRect) => {
			setActiveFly((prev) =>
				prev?.providerId === providerId
					? { ...prev, to, toMeasured: true }
					: prev,
			);
		},
		[],
	);

	const completeFly = useCallback(
		(providerId: number, options?: { syncNavigateImmediately?: boolean }) => {
			setActiveFly((prev) => (prev?.providerId === providerId ? null : prev));
			setLandingProviderIds((prev) => {
				if (!prev.has(providerId)) return prev;
				const next = new Set(prev);
				next.delete(providerId);
				return next;
			});
			// rAF so compact layout is committed before the blur reveal runs.
			requestAnimationFrame(() => {
				setPillDockPhase("expanded");
				setPillLandBounceKey((key) => key + 1);
			});
			const resolve = completeResolversRef.current.get(providerId);
			if (resolve) {
				completeResolversRef.current.delete(providerId);
				resolve();
			}
			if (commitNavigateTimeoutRef.current != null) {
				clearTimeout(commitNavigateTimeoutRef.current);
			}
			if (options?.syncNavigateImmediately) {
				commitProvidersNavigate();
				return;
			}
			// Grid RSC during reveal can hitch transitions — commit URL after reveal.
			commitNavigateTimeoutRef.current = setTimeout(() => {
				commitNavigateTimeoutRef.current = null;
				commitProvidersNavigate();
			}, WATCHLIST_PILL_NAVIGATE_DEFER_MS);
		},
		[commitProvidersNavigate],
	);

	const flyProviderToFilter = useCallback(
		(
			providerId: number,
			fromRect: DOMRect,
			visual: WatchlistProviderFlyVisual,
		): Promise<void> => {
			const stackIndex = providers.length;
			const toRect = watchlistNextPillLogoLandingRect(stackIndex);
			if (toRect.width <= 0) {
				selectProvider(providerId);
				setPillDockPhase("expanded");
				return Promise.resolve();
			}

			const from = new DOMRect(
				fromRect.left + (fromRect.width - WATCHLIST_ROW_LOGO_SIZE_PX) / 2,
				fromRect.top + (fromRect.height - WATCHLIST_ROW_LOGO_SIZE_PX) / 2,
				WATCHLIST_ROW_LOGO_SIZE_PX,
				WATCHLIST_ROW_LOGO_SIZE_PX,
			);

			if (stackIndex === 0) {
				setPillDockPhase("compact");
			}

			setLandingProviderIds((prev) => new Set(prev).add(providerId));
			setActiveFly({
				providerId,
				from,
				to: toRect,
				toMeasured: false,
				...visual,
			});
			selectProvider(providerId, { deferNavigate: true });

			return new Promise((resolve) => {
				completeResolversRef.current.set(providerId, resolve);
			});
		},
		[providers.length, selectProvider],
	);

	const chromeValue = useMemo(
		() => ({
			landingProviderIds,
			pillDockPhase,
			pillLandBounceKey,
			flyProviderToFilter,
		}),
		[landingProviderIds, pillDockPhase, pillLandBounceKey, flyProviderToFilter],
	);

	const motionValue = useMemo(
		() => ({
			activeFly,
			completeFly,
			markFlyTargetMeasured,
		}),
		[activeFly, completeFly, markFlyTargetMeasured],
	);

	return (
		<WatchlistProviderFlyChromeContext.Provider value={chromeValue}>
			<WatchlistProviderFlyMotionContext.Provider value={motionValue}>
				{children}
			</WatchlistProviderFlyMotionContext.Provider>
		</WatchlistProviderFlyChromeContext.Provider>
	);
}

/** Filter pill + platform row — does not re-render when `activeFly.toMeasured` flips. */
export function useWatchlistProviderFlyChrome(): WatchlistProviderFlyChromeContextValue {
	const ctx = useContext(WatchlistProviderFlyChromeContext);
	if (ctx == null) {
		throw new Error(
			"useWatchlistProviderFlyChrome must be used within WatchlistProviderFlyProvider",
		);
	}
	return ctx;
}

/** Fly ghost layer only. */
export function useWatchlistProviderFlyMotion(): WatchlistProviderFlyMotionContextValue {
	const ctx = useContext(WatchlistProviderFlyMotionContext);
	if (ctx == null) {
		throw new Error(
			"useWatchlistProviderFlyMotion must be used within WatchlistProviderFlyProvider",
		);
	}
	return ctx;
}

/** @deprecated Prefer `useWatchlistProviderFlyChrome` or `useWatchlistProviderFlyMotion`. */
export function useWatchlistProviderFly(): WatchlistProviderFlyChromeContextValue &
	WatchlistProviderFlyMotionContextValue {
	return {
		...useWatchlistProviderFlyChrome(),
		...useWatchlistProviderFlyMotion(),
	};
}
