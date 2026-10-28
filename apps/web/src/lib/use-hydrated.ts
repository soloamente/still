"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to — hydration is a one-way flip, not a changing store. */
function subscribe(): () => void {
	return () => {};
}

/**
 * `false` for the server render AND the client's hydration render, `true` for
 * every render after. Gate client-only state (a transition that began before a
 * lazily-hydrated Suspense boundary reached its turn, localStorage reads, ...)
 * behind it so the first client render matches the server HTML.
 */
export function useHydrated(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);
}
