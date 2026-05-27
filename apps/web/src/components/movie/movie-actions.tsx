"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import {
	Bookmark,
	Eye,
	Heart,
	ListPlus,
	Loader2,
	Pencil,
	Plus,
} from "lucide-react";
import { toast } from "sonner";

import { useMovieDetailUserState } from "@/components/movie/use-movie-detail-user-state";
import { useReviewComposer } from "@/components/review/review-composer";

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
	const openReviewComposer = useReviewComposer((s) => s.open);
	const {
		hydrated,
		myLogs,
		inWatchlist,
		busy,
		latestLog,
		handleOpenQuickLog,
		handleEditLatestLog,
		toggleWatchlist,
		toggleHeart,
	} = useMovieDetailUserState(movieId, title);
	const likedVisual = Boolean(latestLog?.liked);

	return (
		<div className="relative isolate z-[31] flex flex-wrap items-center gap-2 pt-2">
			<Button
				variant="accent"
				size="pill"
				onClick={() => handleOpenQuickLog()}
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
			{hydrated && latestLog ? (
				<Button
					variant="ghost-light"
					size="pill"
					onClick={handleEditLatestLog}
					aria-label="Edit your latest diary log for this film"
				>
					<Pencil className="size-3.5" aria-hidden />
					Edit log
				</Button>
			) : null}
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
