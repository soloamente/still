"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { stillToast } from "@still/ui/components/still-toast";
import IconHeart from "@still/ui/icons/heart";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { LogRatingSlider } from "@/components/log/log-rating-slider";
import { LogWatchedDatePicker } from "@/components/log/log-watched-date-picker";
import { QuickLogRemoveConfirmDialog } from "@/components/log/quick-log-remove-confirm-dialog";
import { TvLogScopePicker } from "@/components/log/tv-log-scope-picker";
import {
	DetailMotionButton,
	DetailMotionButtonWrap,
} from "@/components/movie/detail-motion-pressable";
import {
	type ContentVisibility,
	VisibilitySelect,
} from "@/components/review/visibility-select";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { APP_MODAL_POPOVER_POSITIONER_CLASS } from "@/lib/app-modal-layer";
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
import type { MyTvLog } from "@/lib/my-tv-log";
import {
	quickLogSheetHeading,
	quickLogSubmitLabel,
} from "@/lib/quick-log-copy";
import {
	deleteLog,
	fetchMoviesSearch,
	patchLog,
	postLog,
} from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";
import { countTvLogsInScope } from "@/lib/tv-log-scope-prior";
import type { TvLogScope } from "@/lib/tv-watch-types";

/** Max note length — keep in sync with `apps/server` log create validation. */
const NOTE_MAX = 500;

const DEFAULT_RATING = 7;

type MovieHit = {
	id: number;
	title: string;
	year?: string;
	poster_url: string | null;
};

export type QuickLogArgs = {
	movieId?: number;
	/** TMDb TV id — mutually exclusive with `movieId` for new logs; same numeric space as films on TMDb. */
	tvId?: number;
	movieTitle?: string;
	posterUrl?: string | null;
	/** TMDb or Sense community average on 0–10 for the ghost bar under the slider. */
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
	/** TV only — recompute rewatch when scope/season/episode changes in the sheet. */
	priorTvLogs?: MyTvLog[];
	/** TV diary scope — defaults to whole show when omitted. */
	logScope?: "show" | "season" | "episode";
	seasonNumber?: number;
	episodeNumber?: number;
	/** Prefills the visibility picker when editing an existing log. */
	visibility?: "public" | "followers" | "friends" | "private";
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

/** Mirrors server `validateTvLogScope` — blocks submit until season/episode picks are set. */
function tvLogScopeIsComplete(
	scope: TvLogScope,
	seasonNumber: number | null,
	episodeNumber: number | null,
): boolean {
	if (scope === "show") return true;
	if (scope === "season") return seasonNumber != null;
	if (scope === "episode") {
		return seasonNumber != null && episodeNumber != null;
	}
	return false;
}

function tvLogScopePayload(
	scope: TvLogScope,
	seasonNumber: number | null,
	episodeNumber: number | null,
) {
	return {
		logScope: scope,
		...(scope !== "show" && seasonNumber != null ? { seasonNumber } : {}),
		...(scope === "episode" && episodeNumber != null ? { episodeNumber } : {}),
	};
}

/**
 * Cinematic log / edit sheet — rating slider, watch venue, rewatch, and favorite.
 * Mounted in `AppShell` so any client surface can open it via `useQuickLog`.
 */
export function QuickLogRoot() {
	const { isOpen, args, close } = useQuickLog();
	const router = useRouter();
	const pathname = usePathname();
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
	const [logScope, setLogScope] = useState<TvLogScope>("show");
	const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
	const [episodeNumber, setEpisodeNumber] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [visibility, setVisibility] = useState<ContentVisibility>(
		args?.visibility ?? "public",
	);
	const [visibilityTouched, setVisibilityTouched] = useState(false);

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
	const metaRowLayoutTransition = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 420, damping: 32 };
	/**
	 * Defer shared-layout / `layout` until the sheet entrance finishes — parent scale+y
	 * otherwise projects venue pill + meta row controls from the wrong origin on open.
	 */
	const [sheetLayoutActive, setSheetLayoutActive] = useState(false);
	const [showFooterFade, setShowFooterFade] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);
	/** Skip first TV scope effect pass so `args.rewatch` is not cleared on open. */
	const tvScopeEffectReady = useRef(false);
	const scrollContentKey = [
		needsCatalogPick,
		tvId,
		logScope,
		seasonNumber,
		episodeNumber,
		searchResults.length,
	].join("|");

	/** Hide the bottom scrim once the patron scrolls to the end — mirrors `ReviewComposerRoot`. */
	const syncFooterFade = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		setShowFooterFade(distanceFromBottom > 8);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			setSheetLayoutActive(false);
			return;
		}
		const timer = window.setTimeout(() => setSheetLayoutActive(true), 190);
		return () => clearTimeout(timer);
	}, [isOpen]);

	useEffect(() => {
		void scrollContentKey;
		if (!isOpen) {
			setShowFooterFade(true);
			return;
		}
		const el = scrollRef.current;
		if (!el) return;
		syncFooterFade();
		el.addEventListener("scroll", syncFooterFade, { passive: true });
		return () => el.removeEventListener("scroll", syncFooterFade);
	}, [isOpen, syncFooterFade, scrollContentKey]);

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
			setLogScope("show");
			setSeasonNumber(null);
			setEpisodeNumber(null);
			setSearchQuery("");
			setSearchResults([]);
			setSearching(false);
			setSearchHint(null);
			setVisibility("public");
			setVisibilityTouched(false);
			tvScopeEffectReady.current = false;
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
			setLogScope(args.logScope ?? "show");
			setSeasonNumber(args.seasonNumber ?? null);
			setEpisodeNumber(args.episodeNumber ?? null);
			setVisibility(args.visibility ?? "public");
			setVisibilityTouched(false);
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
		const scope = args.logScope ?? "show";
		const scopedPrior =
			args.priorTvLogs != null
				? countTvLogsInScope(args.priorTvLogs, {
						logScope: scope,
						seasonNumber: args.seasonNumber ?? null,
						episodeNumber: args.episodeNumber ?? null,
					})
				: (args.priorLogCount ?? 0);
		// Honor explicit rewatch from rewatch entry points (hero / season row).
		setRewatch(Boolean(args.rewatch) || scopedPrior > 0);
		tvScopeEffectReady.current = false;
		setWatchVenue("streaming");
		setLogScope(scope);
		setSeasonNumber(args.seasonNumber ?? null);
		setEpisodeNumber(args.episodeNumber ?? null);
	}, [isOpen, args]);

	// TV: recompute rewatch when scope changes after open (not on first paint).
	useEffect(() => {
		if (!isOpen || !args?.priorTvLogs || args.logId || tvId == null) return;
		if (!tvScopeEffectReady.current) {
			tvScopeEffectReady.current = true;
			return;
		}
		const count = countTvLogsInScope(args.priorTvLogs, {
			logScope,
			seasonNumber,
			episodeNumber,
		});
		setRewatch(count > 0);
	}, [
		isOpen,
		args?.priorTvLogs,
		args?.logId,
		tvId,
		logScope,
		seasonNumber,
		episodeNumber,
	]);

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
		if (
			tvId != null &&
			!tvLogScopeIsComplete(logScope, seasonNumber, episodeNumber)
		) {
			return false;
		}
		return true;
	}, [
		movieId,
		tvId,
		watchedDate,
		note.length,
		logScope,
		seasonNumber,
		episodeNumber,
	]);

	const handleClose = useCallback(() => {
		setRemoveConfirmOpen(false);
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
					...(visibilityTouched ? { visibility } : {}),
					...(tvId != null
						? tvLogScopePayload(logScope, seasonNumber, episodeNumber)
						: {}),
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
				// Diary lobby hoists logs in the RSC shell — refresh so edits show without a full navigation.
				if (pathname.startsWith("/diary")) {
					router.refresh();
				}
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
				...(visibilityTouched ? { visibility } : {}),
				...(tvId != null
					? tvLogScopePayload(logScope, seasonNumber, episodeNumber)
					: {}),
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

	async function confirmRemoveFromWatched() {
		const logId = args?.logId;
		if (!logId) return;
		setRemoving(true);
		try {
			const result = await deleteLog(logId);
			if (!result.ok) {
				console.error("[quick-log] delete failed", result.error);
				toast.error("Couldn't remove from watched");
				return;
			}
			const label = movieTitle.trim() || "This title";
			stillToast.updated(`Removed “${label}” from watched`);
			setRemoveConfirmOpen(false);
			args.onSuccess?.();
			if (
				pathname.startsWith("/home") ||
				pathname.startsWith("/diary") ||
				pathname.startsWith("/profile") ||
				pathname.startsWith("/movies/") ||
				pathname.startsWith("/tv/")
			) {
				router.refresh();
			}
			handleClose();
		} catch (err) {
			console.error("[quick-log] delete failed", err);
			toast.error("Couldn't remove from watched");
		} finally {
			setRemoving(false);
		}
	}

	if (!args) return null;

	const showSheet = isOpen && args != null;

	const isSeriesLog = tvId != null;
	const heading = isEditMode
		? "Update your screening"
		: quickLogSheetHeading({
				isSeries: isSeriesLog,
				rewatch,
				logScope,
			});

	const primaryLabel = isEditMode
		? "Save"
		: quickLogSubmitLabel({
				isSeries: isSeriesLog,
				rewatch,
				logScope,
			});

	return (
		<>
			<AnimatePresence mode="wait">
				{showSheet ? (
					<motion.div
						key="quick-log-sheet"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18 }}
						className="fixed inset-0 z-50 grid place-items-end bg-absolute-black/82 backdrop-blur-sm md:place-items-center"
						onClick={handleClose}
					>
						<motion.div
							key="quick-log-panel"
							role="dialog"
							aria-modal="true"
							aria-labelledby="quick-log-title"
							layout
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

							<div className="relative">
								<div
									ref={scrollRef}
									className="max-h-[min(calc(92svh-11rem),640px)] overflow-y-auto overscroll-contain pb-24 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
								>
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
												<p className="text-muted-foreground text-xs">
													Searching…
												</p>
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

									{tvId != null ? (
										<TvLogScopePicker
											tvId={tvId}
											logScope={logScope}
											seasonNumber={seasonNumber}
											episodeNumber={episodeNumber}
											onScopeChange={setLogScope}
											onSeasonChange={setSeasonNumber}
											onEpisodeChange={setEpisodeNumber}
										/>
									) : null}

									<fieldset className="mx-auto mb-5 w-fit border-0 p-0">
										<legend className="sr-only">Where did you watch?</legend>
										<div className="flex justify-center">
											<SegmentedPillToolbar
												layoutId="quick-log-venue-pill"
												aria-label="Watch venue"
												value={watchVenue}
												onChange={setWatchVenue}
												options={[
													{ id: "theaters", label: "In cinemas" },
													{ id: "streaming", label: "At home" },
												]}
											/>
										</div>
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
											<SegmentedPillToolbar
												layoutId="quick-log-screening-pill"
												aria-label="First watch or rewatch"
												value={rewatch ? "rewatch" : "first"}
												onChange={(next) => setRewatch(next === "rewatch")}
												options={[
													{ id: "first", label: "First watch" },
													{ id: "rewatch", label: "Rewatch" },
												]}
											/>
											<DetailMotionButton
												layout={sheetLayoutActive ? "position" : false}
												className={cn(
													"inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-background transition-colors duration-200 ease-out motion-reduce:transition-none",
													!liked && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
													liked && "bg-foreground text-background",
												)}
												aria-pressed={liked}
												aria-label={
													liked ? "Remove favorite" : "Mark as favorite"
												}
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

										<label
											className="mx-auto flex w-full max-w-sm flex-col gap-1.5 text-sm"
											htmlFor="log-visibility"
										>
											<span className="text-center text-muted-foreground text-xs">
												Who can see this
											</span>
											<VisibilitySelect
												id="log-visibility"
												value={visibility}
												onChange={(next) => {
													setVisibility(next);
													setVisibilityTouched(true);
												}}
												popoverPositionerClassName={
													APP_MODAL_POPOVER_POSITIONER_CLASS
												}
											/>
										</label>
									</div>
								</div>
								{/* Compose-only scrim — sibling of scroll, not measured for layout (review composer). */}
								<div
									aria-hidden
									className={cn(
										"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-25% from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
										showFooterFade ? "opacity-100" : "opacity-0",
									)}
								/>
							</div>

							<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
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
												"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 font-medium text-destructive",
												DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
											)}
											disabled={saving || removing}
											onClick={() => setRemoveConfirmOpen(true)}
										>
											{removing ? (
												<Loader2
													className="size-3.5 animate-spin"
													aria-hidden
												/>
											) : null}
											Remove
										</Button>
									</DetailMotionButtonWrap>
								)}
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										className="hover:!bg-foreground hover:!text-background h-auto min-h-10 min-w-[8.5rem] bg-foreground px-5 py-2.5 text-background text-base [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
										disabled={!canSubmit || saving || removing}
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
			{removeConfirmOpen ? (
				<QuickLogRemoveConfirmDialog
					open
					titleLabel={movieTitle.trim() || "this title"}
					removing={removing}
					onCancel={() => setRemoveConfirmOpen(false)}
					onConfirm={() => void confirmRemoveFromWatched()}
				/>
			) : null}
		</>
	);
}
