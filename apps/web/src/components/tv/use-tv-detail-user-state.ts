"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import type { MyTvLog } from "@/lib/my-tv-log";
import {
	deleteWatchlistTvItem,
	fetchMyLogsForTv,
	fetchWatchlistCheckTv,
	patchLog,
	postLog,
	postWatchlistAdd,
} from "@/lib/still-api-fetch";
import { countTvLogsInScope } from "@/lib/tv-log-scope-prior";
import type { TvLogScope } from "@/lib/tv-watch-types";

export type { MyTvLog } from "@/lib/my-tv-log";

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

	function handleOpenQuickLog(
		scope?: {
			logScope?: "show" | "season" | "episode";
			seasonNumber?: number;
			episodeNumber?: number;
		},
		openOpts?: { asRewatch?: boolean },
	) {
		const logScope = scope?.logScope ?? "show";
		const scopeTarget = {
			logScope,
			seasonNumber: scope?.seasonNumber ?? null,
			episodeNumber: scope?.episodeNumber ?? null,
		};
		const scopedPrior = countTvLogsInScope(myLogs, scopeTarget);
		const isRewatch = openOpts?.asRewatch ?? scopedPrior > 0;
		openQuickLog({
			tvId,
			movieTitle: title,
			posterUrl: options?.posterUrl ?? undefined,
			averageRating: options?.averageRating ?? undefined,
			priorLogCount: scopedPrior,
			priorTvLogs: myLogs,
			rewatch: isRewatch,
			logScope: scope?.logScope,
			seasonNumber: scope?.seasonNumber,
			episodeNumber: scope?.episodeNumber,
			onSuccess: () => {
				void play("reel-clack").catch(() => undefined);
				void refreshUserState();
			},
		});
	}

	function handleEditLog(log: MyTvLog) {
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
			logScope: log.logScope ?? "show",
			seasonNumber: log.seasonNumber ?? undefined,
			episodeNumber: log.episodeNumber ?? undefined,
			onSuccess: () => {
				void play("reel-clack").catch(() => undefined);
				void refreshUserState();
			},
		});
	}

	function handleEditLatestLog() {
		if (!latestLog) return;
		handleEditLog(latestLog);
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
				setInWatchlist(false);
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
				setInWatchlist(true);
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
		handleEditLog,
		handleEditLatestLog,
		toggleWatchlist,
		toggleHeart,
	};
}
