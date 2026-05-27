"use client";

import { useEffect, useState } from "react";

/**
 * Shows the next chip/grid slice immediately on tap while `router.replace` runs.
 * Clears the override once URL-derived `urlValue` matches.
 */
export function useOptimisticLobbyParam<T>(urlValue: T) {
	const [override, setOverride] = useState<T | null>(null);
	const value = override ?? urlValue;

	useEffect(() => {
		if (override !== null && Object.is(override, urlValue)) {
			setOverride(null);
		}
	}, [urlValue, override]);

	return {
		value,
		setOptimistic: setOverride,
	};
}
