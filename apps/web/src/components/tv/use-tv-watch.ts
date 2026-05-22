"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	deleteTvWatchEpisode,
	fetchTvWatchByTv,
	patchTvWatch,
	postTvWatchCompleteSeason,
	postTvWatchMarkEpisode,
	postTvWatchMarkNext,
	postTvWatchStart,
} from "@/lib/still-api-fetch";
import type {
	TvProgressMode,
	TvWatchBundle,
	TvWatchStatus,
} from "@/lib/tv-watch-types";

/**
 * Hydrates `tv_watch` progress for the TV detail page — separate from diary logs
 * so patrons can track episodes without writing a diary entry every time.
 */
export function useTvWatch(tvId: number) {
	const [hydrated, setHydrated] = useState(false);
	const [bundle, setBundle] = useState<TvWatchBundle | null>(null);
	const [busy, setBusy] = useState<
		null | "start" | "status" | "mode" | "mark" | "episode" | "season"
	>(null);

	const watch = bundle?.watch ?? null;
	const watchedEpisodes = bundle?.watchedEpisodes ?? [];
	const nextEpisode = bundle?.nextEpisode ?? null;

	const watchedKeySet = useMemo(() => {
		const set = new Set<string>();
		for (const row of watchedEpisodes) {
			set.add(`${row.seasonNumber}:${row.episodeNumber}`);
		}
		return set;
	}, [watchedEpisodes]);

	const refresh = useCallback(async () => {
		const res = await fetchTvWatchByTv(tvId);
		if (!res.error && res.data) {
			setBundle(res.data);
		} else {
			setBundle({
				watch: null,
				show: null,
				watchedEpisodes: [],
				nextEpisode: null,
			});
		}
	}, [tvId]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			await refresh();
			if (!cancelled) setHydrated(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [refresh]);

	function applyBundle(next: TvWatchBundle | null) {
		if (next) setBundle(next);
	}

	async function startWatching(progressMode?: TvProgressMode) {
		setBusy("start");
		try {
			const result = await postTvWatchStart({ tvId, progressMode });
			if (!result.ok || !result.data) {
				toast.error("Couldn't start watching");
				return;
			}
			applyBundle(result.data);
			toast.success("Started watching");
		} catch (err) {
			console.error("[use-tv-watch] start failed", err);
			toast.error("Couldn't start watching");
		} finally {
			setBusy(null);
		}
	}

	async function setStatus(status: TvWatchStatus) {
		if (!watch) return;
		setBusy("status");
		try {
			const result = await patchTvWatch(watch.id, { status });
			if (!result.ok || !result.data) {
				toast.error("Couldn't update status");
				return;
			}
			applyBundle(result.data);
		} catch (err) {
			console.error("[use-tv-watch] status failed", err);
			toast.error("Couldn't update status");
		} finally {
			setBusy(null);
		}
	}

	async function setProgressMode(progressMode: TvProgressMode) {
		if (!watch) return;
		setBusy("mode");
		try {
			const result = await patchTvWatch(watch.id, { progressMode });
			if (!result.ok || !result.data) {
				toast.error("Couldn't switch progress mode");
				return;
			}
			applyBundle(result.data);
		} catch (err) {
			console.error("[use-tv-watch] mode failed", err);
			toast.error("Couldn't switch progress mode");
		} finally {
			setBusy(null);
		}
	}

	async function markSeasonComplete(seasonNumber: number) {
		if (!watch) return;
		setBusy("season");
		try {
			const result = await postTvWatchCompleteSeason(watch.id, seasonNumber);
			if (!result.ok || !result.data) {
				toast.error("Couldn't mark season complete");
				return;
			}
			applyBundle(result.data);
			return result.data;
		} catch (err) {
			console.error("[use-tv-watch] season complete failed", err);
			toast.error("Couldn't mark season complete");
			return null;
		} finally {
			setBusy(null);
		}
	}

	async function markNextEpisode() {
		if (!watch) return;
		setBusy("mark");
		try {
			const result = await postTvWatchMarkNext(watch.id);
			if (!result.ok || !result.data) {
				toast.error("No next episode to mark");
				return;
			}
			applyBundle(result.data);
		} catch (err) {
			console.error("[use-tv-watch] mark-next failed", err);
			toast.error("Couldn't mark episode");
		} finally {
			setBusy(null);
		}
	}

	async function toggleEpisodeWatched(
		seasonNumber: number,
		episodeNumber: number,
		watched: boolean,
	) {
		if (!watch) return;
		setBusy("episode");
		try {
			const result = watched
				? await postTvWatchMarkEpisode(watch.id, seasonNumber, episodeNumber)
				: await deleteTvWatchEpisode(watch.id, seasonNumber, episodeNumber);
			if (!result.ok || !result.data) {
				toast.error("Couldn't update progress");
				return;
			}
			applyBundle(result.data);
		} catch (err) {
			console.error("[use-tv-watch] episode toggle failed", err);
			toast.error("Couldn't update progress");
		} finally {
			setBusy(null);
		}
	}

	const isActivelyTracking =
		watch?.status === "watching" || watch?.status === "rewatching";

	return {
		hydrated,
		watch,
		watchedEpisodes,
		watchedKeySet,
		nextEpisode,
		bundle,
		busy,
		isActivelyTracking,
		refresh,
		startWatching,
		setStatus,
		setProgressMode,
		markNextEpisode,
		markSeasonComplete,
		toggleEpisodeWatched,
	};
}
