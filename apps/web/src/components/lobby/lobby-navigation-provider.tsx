"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useLobbyTransition } from "@/lib/use-lobby-transition";

interface LobbyNavigationContextValue {
	isPending: boolean;
	navigate: (href: string) => void;
}

const LobbyNavigationContext =
	createContext<LobbyNavigationContextValue | null>(null);

export function LobbyNavigationProvider({ children }: { children: ReactNode }) {
	const { isPending, navigate } = useLobbyTransition();
	const value = useMemo(() => ({ isPending, navigate }), [isPending, navigate]);

	return (
		<LobbyNavigationContext.Provider value={value}>
			{children}
		</LobbyNavigationContext.Provider>
	);
}

export function useLobbyNavigation(): LobbyNavigationContextValue {
	const ctx = useContext(LobbyNavigationContext);
	if (ctx == null) {
		throw new Error(
			"useLobbyNavigation must be used within LobbyNavigationProvider",
		);
	}
	return ctx;
}

/** Detail top bars use instant tab navigation when wrapped in `MovieDetailViewShell`. */
export function useLobbyNavigationOptional(): LobbyNavigationContextValue | null {
	return useContext(LobbyNavigationContext);
}
