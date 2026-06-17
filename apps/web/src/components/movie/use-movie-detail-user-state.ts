"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { dispatchListingEngagementInvalidate } from "@/lib/listing-engagement-invalidate";
import {
	deleteWatchlistItem,
	fetchMyLogsForMovie,
	fetchWatchlistCheck,
	patchLog,
	postLog,
	postWatchlistAdd,
} from "@/lib/still-api-fetch";

/** One row returned by `GET /api/logs/me/by-movie/:movieId` (full `log` row from Drizzle). */
export interface MyMovieLog {
	id: string;
	liked: boolean;
	rewatch?: boolean;
	rating?: number | null;
	note?: string | null;
	watchedAt?: string | null;
	containsSpoilers?: boolean;
	/** In-cinema vs at-home — from `GET /api/logs/me/by-movie/:id`. */
	watchVenue?: string | null;
	visibility?: "public" | "followers" | "friends" | "private";
}

/**
 * Shared diary + watchlist hydration for movie detail surfaces (`MovieActions`, hero cluster).
 * Keeps `/logs/me/by-movie` + `/watchlist/check` in one place so mutations stay consistent.
 */
export function useMovieDetailUserState(
	movieId: number,
	title: string,
	options?: {
		posterUrl?: string | null;
		/** TMDb or Sense community average on 0–10 for the log slider ghost bar. */
		averageRating?: number | null;
	},
) {
	const { play } = useCinematicAudio();
	const openQuickLog = useQuickLog((s) => s.open);

	/** Until this flips false we avoid flashing misleading default labels before GETs land. */
	const [hydrated, setHydrated] = useState(false);
	const [myLogs, setMyLogs] = useState<MyMovieLog[]>([]);
	const [inWatchlist, setInWatchlist] = useState(false);

	const [busy, setBusy] = useState<null | "watchlist" | "like">(null);

	const latestLog = useMemo(() => myLogs[0] ?? null, [myLogs]);

	/** Engagement chips listen for this to refetch community totals after mutations. */
	const notifyEngagementInvalidate = useCallback(() => {
		dispatchListingEngagementInvalidate({
			listingKind: "movie",
			listingId: movieId,
		});
	}, [movieId]);

	/** Refetch authoritative flags after mutations (cheap — two tiny GETs). */
	const refreshUserState = useCallback(async () => {
		const [logsRes, wlRes] = await Promise.all([
			fetchMyLogsForMovie(movieId),
			fetchWatchlistCheck(movieId),
		]);
		if (!logsRes.error && Array.isArray(logsRes.data)) {
			const rows = logsRes.data as MyMovieLog[];
			setMyLogs(rows);
		} else {
			setMyLogs([]);
		}
		const wlPayload = wlRes.data as { inWatchlist?: boolean } | null;
		if (!wlRes.error && wlPayload)
			setInWatchlist(Boolean(wlPayload.inWatchlist));
		else setInWatchlist(false);
	}, [movieId]);

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

	function handleOpenQuickLog(openOpts?: { asRewatch?: boolean }) {
		const isRewatch = openOpts?.asRewatch ?? myLogs.length > 0;
		openQuickLog({
			movieId,
			movieTitle: title,
			posterUrl: options?.posterUrl ?? undefined,
			averageRating: options?.averageRating ?? undefined,
			priorLogCount: myLogs.length,
			priorLiked: myLogs.some((row) => row.liked),
			rewatch: isRewatch,
			onSuccess: () => {
				void play("reel-clack", { category: "feedback" }).catch(
					() => undefined,
				);
				void refreshUserState();
				notifyEngagementInvalidate();
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
			movieId,
			movieTitle: title,
			posterUrl: options?.posterUrl ?? undefined,
			averageRating: options?.averageRating ?? undefined,
			watchedAt: log.watchedAt ?? undefined,
			rating: log.rating ?? null,
			note: log.note ?? null,
			liked: log.liked,
			rewatch: log.rewatch,
			watchVenue,
			...(log.visibility ? { visibility: log.visibility } : {}),
			onSuccess: () => {
				void play("reel-clack", { category: "feedback" }).catch(
					() => undefined,
				);
				void refreshUserState();
				notifyEngagementInvalidate();
			},
		});
	}

	async function toggleWatchlist() {
		setBusy("watchlist");
		try {
			if (inWatchlist) {
				const result = await deleteWatchlistItem(movieId);
				if (!result.ok) {
					toast.error("Couldn't remove from watchlist");
					return;
				}
				toast.success("Removed from watchlist");
				setInWatchlist(false);
			} else {
				const result = await postWatchlistAdd({ movieId });
				if (!result.ok) {
					console.error(
						"[movie-detail-user-state] watchlist failed",
						result.error,
					);
					toast.error("Couldn't update your watchlist");
					return;
				}
				toast.success("Added to watchlist");
				setInWatchlist(true);
			}
			await refreshUserState();
			notifyEngagementInvalidate();
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
					movieId,
					watchedAt: new Date().toISOString(),
					liked: true,
				});
				if (!result.ok) {
					toast.error("Couldn't like this film yet");
					return;
				}
				void play("reel-clack", { category: "feedback" }).catch(
					() => undefined,
				);
				toast.success("Marked as liked");
				await refreshUserState();
				notifyEngagementInvalidate();
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
			notifyEngagementInvalidate();
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
