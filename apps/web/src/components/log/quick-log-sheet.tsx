"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { StarRating } from "@/components/rating/star-rating";
import { fetchMoviesSearch, postLog } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

/** Max note length — keep in sync with `apps/server` log create validation. */
const NOTE_MAX = 500;

type MovieHit = {
	id: number;
	title: string;
	year?: string;
	poster_url: string | null;
};

type QuickLogArgs = {
	movieId?: number;
	movieTitle?: string;
	/** Called after a successful save (e.g. refresh movie header + sound). */
	onSuccess?: () => void;
};

type Store = {
	isOpen: boolean;
	args: QuickLogArgs | null;
	open: (args?: QuickLogArgs) => void;
	close: () => void;
};

export const useQuickLog = create<Store>((set) => ({
	isOpen: false,
	args: null,
	open: (args) => set({ isOpen: true, args: args ?? {} }),
	close: () => set({ isOpen: false, args: null }),
}));

function formatTodayLocal(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function isValidYmd(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T12:00:00`);
	return !Number.isNaN(d.getTime());
}

function ymdToNoonIso(ymd: string): string {
	const d = new Date(`${ymd}T12:00:00`);
	return d.toISOString();
}

/**
 * Track B — “Quick log” sheet: pick film (if needed) → date → optional rating → note → submit.
 * Mirrors `ReviewComposerRoot` placement (mounted in `AppShell`) so any client surface can open it.
 */
export function QuickLogRoot() {
	const { isOpen, args, close } = useQuickLog();
	const [movieId, setMovieId] = useState<number | null>(null);
	const [movieTitle, setMovieTitle] = useState("");
	const [watchedDate, setWatchedDate] = useState(formatTodayLocal());
	const [rating, setRating] = useState<number | null>(null);
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);

	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<MovieHit[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchHint, setSearchHint] = useState<string | null>(null);

	const needsFilmPick = args != null && args.movieId == null;

	useEffect(() => {
		if (!isOpen) {
			setMovieId(null);
			setMovieTitle("");
			setWatchedDate(formatTodayLocal());
			setRating(null);
			setNote("");
			setSearchQuery("");
			setSearchResults([]);
			setSearching(false);
			setSearchHint(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !args) return;
		if (typeof args.movieId === "number" && args.movieTitle) {
			setMovieId(args.movieId);
			setMovieTitle(args.movieTitle);
		} else {
			setMovieId(null);
			setMovieTitle("");
		}
	}, [isOpen, args]);

	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (!trimmed || !needsFilmPick || !isOpen) {
			setSearchResults([]);
			setSearchHint(null);
			setSearching(false);
			return;
		}
		setSearching(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchMoviesSearch(trimmed, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setSearchResults([]);
					setSearchHint(null);
					return;
				}
				const data = res.data as { results?: MovieHit[] } | null;
				setSearchHint(tmdbSetupHint(data));
				const list = (data?.results ?? []).slice(0, 8).map((m) => ({
					id: m.id,
					title: m.title,
					year:
						(m as { release_date?: string }).release_date?.slice(0, 4) ?? "",
					poster_url: m.poster_url,
				}));
				setSearchResults(list);
			} catch {
				if (!ctrl.signal.aborted) {
					setSearchResults([]);
					setSearchHint(null);
				}
			} finally {
				setSearching(false);
			}
		}, 220);
		return () => {
			ctrl.abort();
			clearTimeout(timer);
		};
	}, [searchQuery, needsFilmPick, isOpen]);

	const canSubmit = useMemo(() => {
		if (movieId == null) return false;
		if (!isValidYmd(watchedDate)) return false;
		if (note.length > NOTE_MAX) return false;
		return true;
	}, [movieId, watchedDate, note.length]);

	const handleClose = useCallback(() => {
		close();
	}, [close]);

	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isOpen, handleClose]);

	async function submit() {
		if (!canSubmit || movieId == null) return;
		setSaving(true);
		try {
			const result = await postLog({
				movieId,
				watchedAt: ymdToNoonIso(watchedDate),
				rating: rating ?? undefined,
				note: note.trim() ? note.trim() : undefined,
			});
			if (!result.ok || !result.data) {
				console.error("[quick-log] post failed", result.error);
				toast.error("Couldn't save this log");
				return;
			}
			toast.success(
				movieTitle.trim() ? `Logged “${movieTitle}”` : "Saved to diary",
			);
			args?.onSuccess?.();
			handleClose();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't save this log");
		} finally {
			setSaving(false);
		}
	}

	const headerTitle = movieTitle || "Log a film";

	if (!args) return null;

	return (
		<AnimatePresence>
			{isOpen ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					className="fixed inset-0 z-50 grid place-items-end bg-absolute-black/82 backdrop-blur-sm md:place-items-center"
					onClick={handleClose}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby="quick-log-title"
						initial={{ y: 32, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={{ y: 16, opacity: 0, scale: 0.98 }}
						transition={{ duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }}
						onClick={(e) => e.stopPropagation()}
						className="max-h-[min(92svh,720px)] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl md:rounded-2xl"
					>
						<header className="sticky top-0 z-10 flex items-start justify-between border-border border-b bg-card/95 p-4 backdrop-blur-sm">
							<div>
								<p className="text-muted-foreground text-xs uppercase tracking-wider">
									Diary
								</p>
								<h2 id="quick-log-title" className="font-serif text-xl">
									{headerTitle}
								</h2>
							</div>
							<Button
								variant="ghost"
								size="icon-pill"
								onClick={handleClose}
								aria-label="Close"
							>
								<X className="size-4" />
							</Button>
						</header>

						<form
							className="space-y-4 p-4"
							onSubmit={(e) => {
								e.preventDefault();
								void submit();
							}}
						>
							{needsFilmPick ? (
								<div className="space-y-2">
									<Label htmlFor="quick-log-search">Film</Label>
									<Input
										id="quick-log-search"
										type="search"
										autoComplete="off"
										spellCheck={false}
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										placeholder="Search by title…"
										className="min-h-11 text-base"
									/>
									{searchHint ? (
										<p className="text-amber-600 text-xs">{searchHint}</p>
									) : null}
									{searching ? (
										<p className="text-muted-foreground text-xs">Searching…</p>
									) : searchQuery.trim() && searchResults.length === 0 ? (
										<p className="text-muted-foreground text-xs">
											No matches — try another title.
										</p>
									) : null}
									<ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1">
										{searchResults.map((m) => (
											<li key={m.id}>
												<button
													type="button"
													className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/80"
													onClick={() => {
														setMovieId(m.id);
														setMovieTitle(
															m.title + (m.year ? ` (${m.year})` : ""),
														);
														setSearchQuery("");
														setSearchResults([]);
													}}
												>
													<span className="line-clamp-2 font-medium">
														{m.title}
													</span>
													{m.year ? (
														<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
															{m.year}
														</span>
													) : null}
												</button>
											</li>
										))}
									</ul>
									{movieId != null ? (
										<p className="text-muted-foreground text-xs">
											Selected:{" "}
											<span className="text-foreground">{movieTitle}</span>
										</p>
									) : null}
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									Logging{" "}
									<span className="font-medium text-foreground">
										{movieTitle}
									</span>
								</p>
							)}

							<div className="space-y-2">
								<Label htmlFor="quick-log-date">Watched on</Label>
								<Input
									id="quick-log-date"
									type="date"
									required
									value={watchedDate}
									onChange={(e) => setWatchedDate(e.target.value)}
									className="min-h-11 text-base"
								/>
							</div>

							<div className="space-y-2">
								<Label>Rating (optional)</Label>
								<StarRating value={rating} onChange={setRating} size="lg" />
							</div>

							<div className="space-y-2">
								<Label htmlFor="quick-log-note">Note (optional)</Label>
								<Textarea
									id="quick-log-note"
									value={note}
									onChange={(e) => setNote(e.target.value)}
									rows={4}
									maxLength={NOTE_MAX}
									placeholder="One line, a mood, where you saw it…"
									spellCheck={false}
								/>
								<p className="text-muted-foreground text-xs tabular-nums">
									{note.length} / {NOTE_MAX}
								</p>
							</div>

							<footer className="flex items-center justify-end gap-2 border-border border-t pt-4">
								<Button
									type="button"
									variant="ghost-light"
									size="pill"
									onClick={handleClose}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									variant="accent"
									size="pill"
									disabled={!canSubmit || saving}
								>
									{saving ? (
										<Loader2 className="size-3.5 animate-spin" aria-hidden />
									) : null}
									Save log
								</Button>
							</footer>
						</form>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
