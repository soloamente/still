"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { stillToast } from "@still/ui/components/still-toast";
import IconHeart from "@still/ui/icons/heart";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "motion/react";
import Image from "next/image";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { LogRatingSlider } from "@/components/log/log-rating-slider";
import { LogWatchedDatePicker } from "@/components/log/log-watched-date-picker";
import {
	DetailMotionButton,
	DetailMotionButtonWrap,
} from "@/components/movie/detail-motion-pressable";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";
import type { HomeVenue } from "@/lib/home-venue";
import {
	clampLogRatingDisplay,
	logRatingToDisplay,
	logRatingToStored,
} from "@/lib/log-rating";
import { formatTodayYmd, isValidYmd } from "@/lib/log-watched-date";
import { fetchMoviesSearch, patchLog, postLog } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

/** Max note length — keep in sync with `apps/server` log create validation. */
const NOTE_MAX = 500;

const DEFAULT_RATING = 7;

type MovieHit = {
	id: number;
	title: string;
	year?: string;
	poster_url: string | null;
};

type QuickLogArgs = {
	movieId?: number;
	/** TMDb TV id — mutually exclusive with `movieId` for new logs; same numeric space as films on TMDb. */
	tvId?: number;
	movieTitle?: string;
	posterUrl?: string | null;
	/** TMDb or Still community average on 0–10 for the ghost bar under the slider. */
	averageRating?: number | null;
	/**
	 * When set, the sheet PATCHes this row instead of POSTing a new log (same form as create).
	 */
	logId?: string;
	/** ISO watched timestamp — prefills the date picker when editing. */
	watchedAt?: string;
	/** Stored API rating (tenths or legacy 1–10). */
	rating?: number | null;
	note?: string | null;
	liked?: boolean;
	rewatch?: boolean;
	/** Prefills **Where did you watch** when editing. */
	watchVenue?: HomeVenue;
	/** When logging again after an existing diary row — defaults rewatch on. */
	priorLogCount?: number;
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

function ymdToNoonIso(ymd: string): string {
	return new Date(`${ymd}T12:00:00`).toISOString();
}

/** Local calendar day for `<input type="date">` — avoids UTC `slice(0,10)` off-by-one. */
function isoToLocalYmd(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return formatTodayYmd();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function posterSrcFromPath(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w342${fragment}`;
}

/**
 * Cinematic log / edit sheet — rating slider, watch venue, rewatch, and favorite.
 * Mounted in `AppShell` so any client surface can open it via `useQuickLog`.
 */
export function QuickLogRoot() {
	const { isOpen, args, close } = useQuickLog();
	const [movieId, setMovieId] = useState<number | null>(null);
	const [tvId, setTvId] = useState<number | null>(null);
	const [movieTitle, setMovieTitle] = useState("");
	const [posterUrl, setPosterUrl] = useState<string | null>(null);
	const [averageRating, setAverageRating] = useState<number | null>(null);
	const [watchedDate, setWatchedDate] = useState(formatTodayYmd());
	const [ratingDisplay, setRatingDisplay] = useState(DEFAULT_RATING);
	const [includeRating, setIncludeRating] = useState(true);
	const [note, setNote] = useState("");
	const [watchVenue, setWatchVenue] = useState<HomeVenue>("streaming");
	const [liked, setLiked] = useState(false);
	const [rewatch, setRewatch] = useState(false);
	const [saving, setSaving] = useState(false);

	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<MovieHit[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchHint, setSearchHint] = useState<string | null>(null);

	const needsCatalogPick =
		args != null &&
		args.logId == null &&
		args.movieId == null &&
		args.tvId == null;
	const isEditMode = Boolean(args?.logId);
	const reduceMotion = useReducedMotion();
	const detailMotion = useDetailActionMotion();
	const venuePillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};
	const metaRowLayoutTransition = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 420, damping: 32 };
	/**
	 * Defer shared-layout / `layout` until the sheet entrance finishes — parent scale+y
	 * otherwise projects venue pill + meta row controls from the wrong origin on open.
	 */
	const [sheetLayoutActive, setSheetLayoutActive] = useState(false);

	useEffect(() => {
		if (!isOpen) {
			setSheetLayoutActive(false);
			return;
		}
		const timer = window.setTimeout(() => setSheetLayoutActive(true), 190);
		return () => clearTimeout(timer);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			setMovieId(null);
			setTvId(null);
			setMovieTitle("");
			setPosterUrl(null);
			setAverageRating(null);
			setWatchedDate(formatTodayYmd());
			setRatingDisplay(DEFAULT_RATING);
			setIncludeRating(true);
			setNote("");
			setWatchVenue("streaming");
			setLiked(false);
			setRewatch(false);
			setSearchQuery("");
			setSearchResults([]);
			setSearching(false);
			setSearchHint(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !args) return;
		if (args.logId) {
			if (typeof args.movieId === "number") {
				setMovieId(args.movieId);
				setTvId(null);
			} else if (typeof args.tvId === "number") {
				setTvId(args.tvId);
				setMovieId(null);
			}
			if (args.movieTitle) setMovieTitle(args.movieTitle);
			setPosterUrl(posterSrcFromPath(args.posterUrl) ?? null);
			setAverageRating(args.averageRating ?? null);
			if (args.watchedAt) setWatchedDate(isoToLocalYmd(args.watchedAt));
			const display = logRatingToDisplay(args.rating);
			if (display != null) {
				setRatingDisplay(display);
				setIncludeRating(true);
			} else {
				setRatingDisplay(DEFAULT_RATING);
				setIncludeRating(false);
			}
			setNote(args.note ?? "");
			setLiked(Boolean(args.liked));
			setRewatch(Boolean(args.rewatch));
			setWatchVenue(
				args.watchVenue === "theaters" || args.watchVenue === "streaming"
					? args.watchVenue
					: "streaming",
			);
			return;
		}
		if (typeof args.movieId === "number" && args.movieTitle) {
			setMovieId(args.movieId);
			setTvId(null);
			setMovieTitle(args.movieTitle);
		} else if (typeof args.tvId === "number" && args.movieTitle) {
			setTvId(args.tvId);
			setMovieId(null);
			setMovieTitle(args.movieTitle);
		} else {
			setMovieId(null);
			setTvId(null);
			setMovieTitle("");
		}
		setPosterUrl(posterSrcFromPath(args.posterUrl) ?? null);
		setAverageRating(args.averageRating ?? null);
		setRatingDisplay(DEFAULT_RATING);
		setIncludeRating(true);
		setNote("");
		setLiked(false);
		setRewatch(Boolean(args.rewatch) || (args.priorLogCount ?? 0) > 0);
		setWatchVenue("streaming");
	}, [isOpen, args]);

	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (!trimmed || !needsCatalogPick || !isOpen) {
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
	}, [searchQuery, needsCatalogPick, isOpen]);

	const canSubmit = useMemo(() => {
		if (movieId == null && tvId == null) return false;
		if (!isValidYmd(watchedDate)) return false;
		if (note.length > NOTE_MAX) return false;
		return true;
	}, [movieId, tvId, watchedDate, note.length]);

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

	async function persist(options: { skipDetails: boolean }) {
		if (!canSubmit || (movieId == null && tvId == null) || !args) return;
		setSaving(true);
		const storedRating = options.skipDetails
			? null
			: includeRating
				? logRatingToStored(ratingDisplay)
				: null;

		try {
			if (args.logId) {
				const result = await patchLog(args.logId, {
					watchedAt: ymdToNoonIso(watchedDate),
					rating: storedRating,
					note: options.skipDetails ? null : note.trim() ? note.trim() : null,
					watchVenue,
					liked: options.skipDetails ? false : liked,
					rewatch: options.skipDetails ? false : rewatch,
				});
				if (!result.ok || !result.data) {
					console.error("[quick-log] patch failed", result.error);
					toast.error("Couldn't update this log");
					return;
				}
				stillToast.updated(
					movieTitle.trim() ? `Updated “${movieTitle}”` : "Diary log updated",
				);
				args.onSuccess?.();
				handleClose();
				return;
			}

			if (tvId == null && movieId == null) return;

			const logPayload = {
				watchedAt: ymdToNoonIso(watchedDate),
				rating: storedRating ?? undefined,
				note: !options.skipDetails && note.trim() ? note.trim() : undefined,
				watchVenue,
				liked: options.skipDetails ? undefined : liked || undefined,
				rewatch: options.skipDetails ? undefined : rewatch || undefined,
			};

			let result: Awaited<ReturnType<typeof postLog>>;
			if (tvId != null) {
				result = await postLog({ tvId, ...logPayload });
			} else if (movieId != null) {
				result = await postLog({ movieId, ...logPayload });
			} else {
				return;
			}
			if (!result.ok || !result.data) {
				console.error("[quick-log] post failed", result.error);
				toast.error("Couldn't save this log");
				return;
			}
			stillToast.logged(
				movieTitle.trim() ? `Logged “${movieTitle}”` : "Saved to diary",
			);
			args.onSuccess?.();
			handleClose();
		} catch (err) {
			console.error(err);
			toast.error(
				args?.logId ? "Couldn't update this log" : "Couldn't save this log",
			);
		} finally {
			setSaving(false);
		}
	}

	if (!args) return null;

	const isSeriesLog = tvId != null;
	const heading = isEditMode
		? "Update your screening"
		: isSeriesLog
			? "How much did you like this show?"
			: "How much did you like this movie?";

	const primaryLabel = isEditMode
		? "Save"
		: isSeriesLog
			? "Add show"
			: "Add movie";

	// Match `HomeCatalogViewModeToolbar` venue chips (track + sliding pill).
	const venueChip = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

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
						layoutRoot
						initial={{ y: 32, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={{ y: 16, opacity: 0, scale: 0.98 }}
						transition={{ duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }}
						onClick={(e) => e.stopPropagation()}
						className="relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10"
						style={
							{
								"--log-rating-accent": "oklch(0.72 0.14 250)",
							} as CSSProperties
						}
					>
						<div className="mb-4 flex justify-end">
							<Button
								variant="ghost"
								size="icon-pill"
								onClick={handleClose}
								aria-label="Close"
								className="text-muted-foreground"
							>
								<X className="size-4" />
							</Button>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
							{needsCatalogPick ? (
								<div className="mb-6 space-y-2">
									<Label htmlFor="quick-log-search">Pick a film</Label>
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
									<ul className="max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-muted/25 p-1">
										{searchResults.map((m) => (
											<li key={m.id}>
												<button
													type="button"
													className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm [@media(hover:hover)]:hover:bg-muted/60"
													onClick={() => {
														setMovieId(m.id);
														setTvId(null);
														setMovieTitle(
															m.title + (m.year ? ` (${m.year})` : ""),
														);
														setPosterUrl(m.poster_url);
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
								</div>
							) : null}

							{posterUrl ? (
								<div className="mx-auto mb-5 flex justify-center">
									<div className="relative aspect-[2/3] w-[7.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg">
										<Image
											src={posterUrl}
											alt=""
											fill
											sizes="120px"
											className="object-cover"
											unoptimized
										/>
									</div>
								</div>
							) : null}

							<h2
								id="quick-log-title"
								className="mb-6 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
							>
								{heading}
							</h2>

							<fieldset className="mx-auto mb-5 w-fit border-0 p-0">
								<legend className="sr-only">Where did you watch?</legend>
								<LayoutGroup id="quick-log-venue">
									<div className="flex w-fit items-center rounded-full bg-background p-1">
										<div className="flex min-w-0">
											<label className={venueChip(watchVenue === "theaters")}>
												<input
													type="radio"
													name="quick-log-venue"
													value="theaters"
													className="sr-only"
													checked={watchVenue === "theaters"}
													onChange={() => setWatchVenue("theaters")}
												/>
												{watchVenue === "theaters" ? (
													sheetLayoutActive ? (
														<motion.span
															className="absolute inset-0 z-0 rounded-full bg-card"
															layoutId="quick-log-venue-pill"
															transition={venuePillTransition}
														/>
													) : (
														<span className="absolute inset-0 z-0 rounded-full bg-card" />
													)
												) : null}
												<span className="relative z-10">In cinemas</span>
											</label>
											<label className={venueChip(watchVenue === "streaming")}>
												<input
													type="radio"
													name="quick-log-venue"
													value="streaming"
													className="sr-only"
													checked={watchVenue === "streaming"}
													onChange={() => setWatchVenue("streaming")}
												/>
												{watchVenue === "streaming" ? (
													sheetLayoutActive ? (
														<motion.span
															className="absolute inset-0 z-0 rounded-full bg-card"
															layoutId="quick-log-venue-pill"
															transition={venuePillTransition}
														/>
													) : (
														<span className="absolute inset-0 z-0 rounded-full bg-card" />
													)
												) : null}
												<span className="relative z-10">At home</span>
											</label>
										</div>
									</div>
								</LayoutGroup>
							</fieldset>

							<LogRatingSlider
								value={clampLogRatingDisplay(ratingDisplay)}
								onChange={(next) => {
									setRatingDisplay(next);
									setIncludeRating(true);
								}}
								averageRating={averageRating}
								className="mb-5"
							/>

							<div className="mb-6 space-y-5">
								<div className="flex flex-wrap items-end justify-center gap-2">
									<fieldset className="w-fit border-0 p-0">
										<LayoutGroup id="quick-log-screening">
											<div className="flex w-fit items-center rounded-full bg-background p-1">
												<div className="flex min-w-0">
													<label className={venueChip(!rewatch)}>
														<input
															type="radio"
															name="quick-log-screening"
															value="first"
															className="sr-only"
															checked={!rewatch}
															onChange={() => setRewatch(false)}
														/>
														{!rewatch ? (
															sheetLayoutActive ? (
																<motion.span
																	className="absolute inset-0 z-0 rounded-full bg-card"
																	layoutId="quick-log-screening-pill"
																	transition={venuePillTransition}
																/>
															) : (
																<span className="absolute inset-0 z-0 rounded-full bg-card" />
															)
														) : null}
														<span className="relative z-10">First watch</span>
													</label>
													<label className={venueChip(rewatch)}>
														<input
															type="radio"
															name="quick-log-screening"
															value="rewatch"
															className="sr-only"
															checked={rewatch}
															onChange={() => setRewatch(true)}
														/>
														{rewatch ? (
															sheetLayoutActive ? (
																<motion.span
																	className="absolute inset-0 z-0 rounded-full bg-card"
																	layoutId="quick-log-screening-pill"
																	transition={venuePillTransition}
																/>
															) : (
																<span className="absolute inset-0 z-0 rounded-full bg-card" />
															)
														) : null}
														<span className="relative z-10">Rewatch</span>
													</label>
												</div>
											</div>
										</LayoutGroup>
									</fieldset>
									<DetailMotionButton
										layout={sheetLayoutActive ? "position" : false}
										className={cn(
											"inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-background transition-colors duration-200 ease-out motion-reduce:transition-none",
											!liked && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											liked && "bg-foreground text-background",
										)}
										aria-pressed={liked}
										aria-label={liked ? "Remove favorite" : "Mark as favorite"}
										transition={{
											...detailMotion.buttonTransition,
											layout: metaRowLayoutTransition,
										}}
										onClick={() => setLiked((v) => !v)}
									>
										{liked ? (
											<IconHeartFilled className="size-5" aria-hidden />
										) : (
											<IconHeart className="size-5" aria-hidden />
										)}
									</DetailMotionButton>
								</div>

								<div className="mx-auto w-full max-w-sm space-y-2">
									{/* <Label
										htmlFor="quick-log-date"
										className="w-full justify-center text-center text-muted-foreground text-xs"
									>
										Watched on
									</Label> */}
									<LogWatchedDatePicker
										id="quick-log-date"
										value={watchedDate}
										onChange={setWatchedDate}
									/>
								</div>
							</div>
						</div>

						<footer className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
							{!isEditMode ? (
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										className={cn(
											"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-muted-foreground",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										disabled={!canSubmit || saving}
										onClick={() => void persist({ skipDetails: true })}
									>
										Skip
									</Button>
								</DetailMotionButtonWrap>
							) : (
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="ghost"
										size="pill"
										className={cn(
											"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-muted-foreground",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										disabled={saving}
										onClick={handleClose}
									>
										Cancel
									</Button>
								</DetailMotionButtonWrap>
							)}
							<DetailMotionButtonWrap>
								<Button
									type="button"
									variant="default"
									size="pill"
									className="hover:!bg-foreground hover:!text-background h-auto min-h-10 min-w-[8.5rem] bg-foreground px-5 py-2.5 text-background text-base [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
									disabled={!canSubmit || saving}
									onClick={() => void persist({ skipDetails: false })}
								>
									{saving ? (
										<Loader2 className="size-3.5 animate-spin" aria-hidden />
									) : null}
									{primaryLabel}
								</Button>
							</DetailMotionButtonWrap>
						</footer>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
