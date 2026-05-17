"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import { Bookmark, Eye, Heart, ListPlus, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { useReviewComposer } from "@/components/review/review-composer";
import {
	deleteWatchlistItem,
	fetchMyLogsForMovie,
	fetchWatchlistCheck,
	patchLog,
	postLog,
	postWatchlistAdd,
} from "@/lib/still-api-fetch";

/** One row returned by `GET /api/logs/me/by-movie/:movieId`. */
interface MyMovieLog {
	id: string;
	liked: boolean;
	watchedAt?: string | null;
}

/**
 * Diary + watchlist cluster on the movie detail header — kept above hero imagery overlap
 * (see backdrop `pointer-events-none` on the page) so taps always resolve here.
 *
 * Hydrates `/logs/me/by-movie` + `/watchlist/check` so buttons reflect Letterbox-shaped truth.
 */
export function MovieActions({
	movieId,
	title,
}: {
	movieId: number;
	title: string;
}) {
	const { play } = useCinematicAudio();
	const openReviewComposer = useReviewComposer((s) => s.open);
	const openQuickLog = useQuickLog((s) => s.open);

	/** Until this flips false we avoid flashing misleading default labels (“not saved”) before GETs land. */
	const [hydrated, setHydrated] = useState(false);
	const [myLogs, setMyLogs] = useState<MyMovieLog[]>([]);
	const [inWatchlist, setInWatchlist] = useState(false);

	const [busy, setBusy] = useState<null | "watchlist" | "like">(null);

	const latestLog = useMemo(() => myLogs[0] ?? null, [myLogs]);

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

	function handleOpenQuickLog() {
		openQuickLog({
			movieId,
			movieTitle: title,
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
				const result = await deleteWatchlistItem(movieId);
				if (!result.ok) {
					toast.error("Couldn't remove from watchlist");
					return;
				}
				toast.success("Removed from watchlist");
			} else {
				const result = await postWatchlistAdd(movieId);
				if (!result.ok) {
					console.error("[movie-actions] watchlist failed", result.error);
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
					movieId,
					watchedAt: new Date().toISOString(),
					liked: true,
				});
				if (!result.ok) {
					toast.error("Couldn't like this film yet");
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

	const likedVisual = Boolean(latestLog?.liked);

	return (
		<div className="relative isolate z-[31] flex flex-wrap items-center gap-2 pt-2">
			<Button
				variant="accent"
				size="pill"
				onClick={handleOpenQuickLog}
				disabled={!hydrated}
			>
				{!hydrated ? (
					<Loader2 className="size-3.5 animate-spin opacity-70" aria-hidden />
				) : (
					<Eye className="size-3.5" aria-hidden />
				)}
				{hydrated && myLogs.length > 0 ? (
					<>
						Log again
						{myLogs.length > 1 ? (
							<span className="tabular-nums opacity-80"> ×{myLogs.length}</span>
						) : null}
					</>
				) : (
					<>Log</>
				)}
			</Button>
			<Button
				variant={inWatchlist ? "accent" : "ghost-light"}
				size="pill"
				onClick={toggleWatchlist}
				disabled={!hydrated || busy === "watchlist"}
				aria-pressed={inWatchlist}
			>
				{busy === "watchlist" ? (
					<Loader2 className="size-3.5 animate-spin" aria-hidden />
				) : (
					<Bookmark className="size-3.5" aria-hidden />
				)}
				{!hydrated ? "Watchlist" : inWatchlist ? "Saved" : "Watchlist"}
			</Button>
			<Button
				variant={likedVisual ? "accent" : "ghost-light"}
				size="pill"
				onClick={toggleHeart}
				disabled={!hydrated || busy === "like"}
				aria-pressed={likedVisual}
			>
				{busy === "like" ? (
					<Loader2 className="size-3.5 animate-spin" aria-hidden />
				) : (
					<Heart
						className={`size-3.5 ${likedVisual ? "fill-current" : ""}`}
						aria-hidden
					/>
				)}
				{!hydrated ? "Like" : likedVisual ? "Liked" : "Like"}
			</Button>
			<Button
				variant="ghost-light"
				size="pill"
				onClick={() => openReviewComposer({ movieId, movieTitle: title })}
			>
				Review
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="ghost-light" size="pill">
							<ListPlus className="size-3.5" aria-hidden /> Add to list
						</Button>
					}
				/>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						onClick={() => toast.info("List picker coming soon")}
					>
						<Plus className="mr-2 size-3.5" aria-hidden /> New list with this
						film
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
