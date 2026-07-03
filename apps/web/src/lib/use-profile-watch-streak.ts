"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

/**
 * Loads a patron's public diary streak count for the profile header pill.
 * Own profile should use `useWatchStreak` instead — this avoids an extra `/me` call.
 */
export function useProfileWatchStreak(handle: string) {
	const [currentStreak, setCurrentStreak] = useState(0);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		const normalized = handle.trim().toLowerCase();
		if (!normalized) {
			setCurrentStreak(0);
			setLoading(false);
			return;
		}
		try {
			const res = await api.api.profiles({ handle: normalized }).streak.get();
			if (res.error || !res.data) {
				setCurrentStreak(0);
				return;
			}
			const count =
				typeof res.data.currentStreak === "number" ? res.data.currentStreak : 0;
			setCurrentStreak(count);
		} catch {
			setCurrentStreak(0);
		} finally {
			setLoading(false);
		}
	}, [handle]);

	useEffect(() => {
		void load();
	}, [load]);

	return { currentStreak, loading };
}
