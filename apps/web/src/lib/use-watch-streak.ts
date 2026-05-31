"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { WatchStreakSnapshot } from "@/lib/watch-streak-types";

/**
 * Loads the signed-in patron's diary streak and exposes shield activation.
 */
export function useWatchStreak() {
	const [streak, setStreak] = useState<WatchStreakSnapshot | null>(null);
	const [loading, setLoading] = useState(true);
	const [freezeBusy, setFreezeBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			const res = await api.api.streaks.me.get();
			if (res.error) {
				const message =
					typeof res.error.value === "string" ? res.error.value : null;
				if (message?.includes("migration")) {
					console.warn("[useWatchStreak]", message);
				}
				setStreak(null);
				return;
			}
			if (!res.data?.streak) {
				setStreak(null);
				return;
			}
			setStreak(res.data.streak as WatchStreakSnapshot);
		} catch {
			setStreak(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const freeze = useCallback(async () => {
		setFreezeBusy(true);
		try {
			const res = await api.api.streaks.freeze.post();
			if (res.error) {
				const message =
					typeof res.error.value === "string"
						? res.error.value
						: "Could not use a shield";
				toast.error(message);
				return false;
			}
			if (res.data?.streak) {
				setStreak(res.data.streak as WatchStreakSnapshot);
				toast.success("Streak shield active for today");
				return true;
			}
			return false;
		} catch {
			toast.error("Sign in to protect your streak");
			return false;
		} finally {
			setFreezeBusy(false);
		}
	}, []);

	return { streak, loading, freezeBusy, reload: load, freeze };
}
