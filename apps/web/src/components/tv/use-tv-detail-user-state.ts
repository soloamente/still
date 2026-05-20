"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import {
	deleteWatchlistTvItem,
	fetchMyLogsForTv,
	fetchWatchlistCheckTv,
	patchLog,
	postLog,
	postWatchlistAdd,
} from "@/lib/still-api-fetch";

/** One row returned by `GET /api/logs/me/by-tv/:tvId` (full `log` row from Drizzle). */
export interface MyTvLog {
	id: string;
	liked: boolean;
	rewatch?: boolean;
	rating?: number | null;
	note?: string | null;
	watchedAt?: string | null;
	containsSpoilers?: boolean;
	watchVenue?: string | null;
}

/**
 * Diary + watchlist hydration for TV detail — same contract as `useMovieDetailUserState`
 * but hits `/by-tv` and `/watchlist/check/tv` so numeric ids never collide with films.
 */
export function useTvDetailUserState(
	tvId: number,
	title: string,
	options?: {
		posterUrl?: string | null;
		averageRating?: number | null;
	},
) {
	const { play } = useCinematicAudio();
	const openQuickLog = useQuickLog((s) => s.open);

	const [hydrated, setHydrated] = useState(false);
	const [myLogs, setMyLogs] = useState<MyTvLog[]>([]);
	const [inWatchlist, setInWatchlist] = useState(false);

	const [busy, setBusy] = useState<null | "watchlist" | "like">(null);

	const latestLog = useMemo(() => myLogs[0] ?? null, [myLogs]);

	const refreshUserState = useCallback(async () => {
		const [logsRes, wlRes] = await Promise.all([
			fetchMyLogsForTv(tvId),
			fetchWatchlistCheckTv(tvId),
		]);
		if (!logsRes.error && Array.isArray(logsRes.data)) {
			const rows = logsRes.data as MyTvLog[];
			setMyLogs(rows);
		} else {
			setMyLogs([]);
		}
		const wlPayload = wlRes.data as { inWatchlist?: boolean } | null;
		if (!wlRes.error && wlPayload)
			setInWatchlist(Boolean(wlPayload.inWatchlist));
		else setInWatchlist(false);
	}, [tvId]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			await refreshUserState();
			if (!cancelled) setHydrated(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [refreshUserState]);

	function handleOpenQuickLog() {
		openQuickLog({
			tvId,
			movieTitle: title,
			posterUrl: options?.posterUrl ?? undefined,
			averageRating: options?.averageRating ?? undefined,
			priorLogCount: myLogs.length,
			onSuccess: () => {
				void play("reel-clack").catch(() => undefined);
				void refreshUserState();
			},
		});
	}

	function handleEditLatestLog() {
		const log = latestLog;
		if (!log) return;
		const watchVenue =
			log.watchVenue === "theaters" || log.watchVenue === "streaming"
				? log.watchVenue
				: "streaming";
		openQuickLog({
			logId: log.id,
			tvId,
			movieTitle: title,
			posterUrl: options?.posterUrl ?? undefined,
			averageRating: options?.averageRating ?? undefined,
			watchedAt: log.watchedAt ?? undefined,
			rating: log.rating ?? null,
			note: log.note ?? null,
			liked: log.liked,
			rewatch: log.rewatch,
			watchVenue,
			onSuccess: () => {
				void play("reel-clack").catch(() => undefined);
				void refreshUserState();
			},
		});
	}

	async function toggleWatchlist() {
		setBusy("watchlist");
		try {
			if (inWatchlist) {
				const result = await deleteWatchlistTvItem(tvId);
				if (!result.ok) {
					toast.error("Couldn't remove from watchlist");
					return;
				}
				toast.success("Removed from watchlist");
			} else {
				const result = await postWatchlistAdd({ tvId });
				if (!result.ok) {
					console.error(
						"[tv-detail-user-state] watchlist failed",
						result.error,
					);
					toast.error("Couldn't update your watchlist");
					return;
				}
				toast.success("Added to watchlist");
			}
			await refreshUserState();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update your watchlist");
		} finally {
			setBusy(null);
		}
	}

	async function toggleHeart() {
		setBusy("like");
		try {
			if (!latestLog) {
				const result = await postLog({
					tvId,
					watchedAt: new Date().toISOString(),
					liked: true,
				});
				if (!result.ok) {
					toast.error("Couldn't like this show yet");
					return;
				}
				void play("reel-clack").catch(() => undefined);
				toast.success("Marked as liked");
				await refreshUserState();
				return;
			}
			const flipped = !latestLog.liked;
			const patched = await patchLog(latestLog.id, { liked: flipped });
			if (!patched.ok) {
				toast.error("Couldn't update like");
				return;
			}
			toast.success(flipped ? "Marked as liked" : "Removed like");
			await refreshUserState();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update");
		} finally {
			setBusy(null);
		}
	}

	return {
		hydrated,
		myLogs,
		inWatchlist,
		busy,
		latestLog,
		refreshUserState,
		handleOpenQuickLog,
		handleEditLatestLog,
		toggleWatchlist,
		toggleHeart,
	};
}
