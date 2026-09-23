"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";

interface WatchlistLobbyDisplayPrefs {
	monochromePeersOnHover: boolean;
	signedIn: boolean;
}

const DEFAULT_PREFS: WatchlistLobbyDisplayPrefs = {
	monochromePeersOnHover: false,
	// `/watchlist` lives under `(app)` — radial toolkit treats the visitor as signed in.
	signedIn: true,
};

const WatchlistLobbyDisplayPrefsContext =
	createContext<WatchlistLobbyDisplayPrefs>(DEFAULT_PREFS);

const WatchlistLobbyDisplayPrefsSetContext = createContext<
	((next: WatchlistLobbyDisplayPrefs) => void) | null
>(null);

/**
 * Layout-level hover/session prefs for the watchlist wall. Order-chip RSC
 * must not wait on `profiles.me` — chrome hydrates this once per visit.
 */
export function WatchlistLobbyDisplayPrefsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [prefs, setPrefs] = useState<WatchlistLobbyDisplayPrefs>(DEFAULT_PREFS);
	const setter = useMemo(() => setPrefs, []);
	return (
		<WatchlistLobbyDisplayPrefsSetContext.Provider value={setter}>
			<WatchlistLobbyDisplayPrefsContext.Provider value={prefs}>
				{children}
			</WatchlistLobbyDisplayPrefsContext.Provider>
		</WatchlistLobbyDisplayPrefsSetContext.Provider>
	);
}

/** Pushes layout chrome prefs into the poster wall without blocking `?order=` navigations. */
export function WatchlistLobbyDisplayPrefsHydrator({
	monochromePeersOnHover,
	signedIn,
}: WatchlistLobbyDisplayPrefs) {
	const setPrefs = useContext(WatchlistLobbyDisplayPrefsSetContext);
	useLayoutEffect(() => {
		if (setPrefs == null) return;
		setPrefs({ monochromePeersOnHover, signedIn });
	}, [monochromePeersOnHover, setPrefs, signedIn]);
	return null;
}

export function useWatchlistLobbyDisplayPrefs(): WatchlistLobbyDisplayPrefs {
	return useContext(WatchlistLobbyDisplayPrefsContext);
}
