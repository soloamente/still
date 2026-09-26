"use client";

import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
	type RefObject,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { diaryLogToQuickLogOpenPayload } from "@/lib/diary-open-log";
import { diaryTvPosterCloseKind } from "@/lib/diary-tv-episode-dialog-session";
import {
	type DiaryTvEpisodeLog,
	type DiaryTvPill,
	initialSeasonNumber,
	pillForEpisode,
	seasonLogScoreLabel,
	showLogLabel,
} from "@/lib/diary-tv-episode-pills";
import {
	cellCanReceivePoster,
	type DiaryTvPosterFlightLive,
	freezePosterFlightForFade,
	readLiveFlightSample,
} from "@/lib/diary-tv-poster-flight";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import type { MyTvLog } from "@/lib/my-tv-log";
import {
	fetchMyLogsForTv,
	fetchTvSeasonDetail,
	fetchTvSeasons,
} from "@/lib/still-api-fetch";
import { isTmdbCdnUrl, tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import type { TvEpisodeSummary, TvSeasonSummary } from "@/lib/tv-watch-types";

/** Mix `foreground` into `background` — 0 is empty, 10 is full foreground. */
function ratedMixPercent(averageDisplay: number): number {
	return Math.round((averageDisplay / 10) * 100);
}

function ratedPillBackground(averageDisplay: number): string {
	return `color-mix(in oklab, var(--foreground) ${ratedMixPercent(averageDisplay)}%, var(--background))`;
}

function ratedPillTextClass(averageDisplay: number): string {
	return ratedMixPercent(averageDisplay) > 55
		? "text-background"
		: "text-foreground";
}

/** Cinema or at-home only. Any other venue stays unset. */
function diaryWatchVenue(
	raw: MyTvLog["watchVenue"],
): DiaryLogRow["log"]["watchVenue"] {
	if (raw === "theaters" || raw === "streaming") return raw;
	return undefined;
}

/**
 * Same field names as the former `tvLogsToDiaryRows` mapper on `DiaryTvGroupCell`.
 * Keep this aligned so Quick Log still receives the diary row shape.
 * A missing venue is treated as at-home on edit, so cinema logs must keep `watchVenue`.
 * `containsSpoilers` is not copied: `DiaryLogRow` does not have that field.
 */
function tvLogsToDiaryRows(
	data: unknown,
	tmdbId: number,
	title: string,
	posterPath: string | null,
): DiaryLogRow[] {
	if (!Array.isArray(data)) return [];
	const listing = { tmdbId, title, posterPath, year: null };
	return (data as MyTvLog[]).map((l) => ({
		log: {
			id: l.id,
			watchedAt: l.watchedAt ?? new Date(0).toISOString(),
			createdAt: undefined,
			rating: l.rating ?? null,
			liked: l.liked,
			rewatch: l.rewatch ?? false,
			note: l.note ?? null,
			watchVenue: diaryWatchVenue(l.watchVenue),
			logScope: l.logScope ?? "show",
			seasonNumber: l.seasonNumber ?? null,
			episodeNumber: l.episodeNumber ?? null,
			visibility: l.visibility,
		},
		movie: null,
		tv: listing,
	}));
}

function episodeLogsFromRows(
	rows: readonly DiaryLogRow[],
): DiaryTvEpisodeLog[] {
	return rows.map((row) => ({
		id: row.log.id,
		logScope: row.log.logScope ?? "show",
		seasonNumber: row.log.seasonNumber ?? null,
		episodeNumber: row.log.episodeNumber ?? null,
		rating: row.log.rating,
		watchedAt: row.log.watchedAt,
	}));
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function seasonPosterSrc(
	seasonPosterPath: string | null | undefined,
	showPosterPath: string | null,
): string | null {
	// Season art first; fall back to the show poster when TMDb has none.
	return tmdbPosterUrlFromPath(seasonPosterPath ?? showPosterPath, "w342");
}

/** One trip. Position, scale, and the Y flip share this ease — not two waits. */
const POSTER_FLIGHT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const POSTER_FLIGHT_S = 0.45;
const POSTER_CHROME_FADE_S = 0.2;
/** Chrome fade starts late so it finishes with the flight. */
const POSTER_CHROME_DELAY_S = POSTER_FLIGHT_S - POSTER_CHROME_FADE_S;

const POSTER_FADE_TRANSITION = {
	duration: POSTER_CHROME_FADE_S,
	ease: POSTER_FLIGHT_EASE,
};

interface FlightRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface PosterFlightPose {
	/** Cell rect captured when the flight started. Later poses keep this origin. */
	origin: FlightRect;
	x: number;
	y: number;
	scale: number;
	rotateY: number;
	/** Local radius. CSS scale multiplies it, so the slot radius is divided by scale. */
	borderRadius: number;
	opacity: number;
	/** 0.45 for the trip. 0 to stick to the slot or freeze in place when fading. */
	moveDuration: number;
}

function readFlightRect(node: HTMLElement): FlightRect {
	const rect = node.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
	};
}

function readCornerRadius(node: HTMLElement, fallback: number): number {
	const radius = Number.parseFloat(getComputedStyle(node).borderTopLeftRadius);
	return Number.isFinite(radius) ? radius : fallback;
}

/** Center delta from `origin` to `dest`, plus the scale that matches dest's width. */
function flightDelta(origin: FlightRect, dest: FlightRect) {
	const originCx = origin.left + origin.width / 2;
	const originCy = origin.top + origin.height / 2;
	const destCx = dest.left + dest.width / 2;
	const destCy = dest.top + dest.height / 2;
	const scale = origin.width > 0 ? dest.width / origin.width : 1;
	return {
		x: destCx - originCx,
		y: destCy - originCy,
		scale,
	};
}

function localRadius(visualRadius: number, scale: number): number {
	if (scale <= 0) return visualRadius;
	return visualRadius / scale;
}

function PosterFlightFace({
	src,
	side,
}: {
	src: string | null;
	side: "front" | "back";
}) {
	return (
		<div
			className="absolute inset-0 overflow-hidden bg-background"
			style={{
				backfaceVisibility: "hidden",
				borderRadius: "inherit",
				transform: side === "back" ? "rotateY(180deg)" : undefined,
			}}
		>
			{src ? (
				<Image
					src={src}
					alt=""
					fill
					sizes="(max-width: 640px) 40vw, 176px"
					className="object-cover"
					unoptimized={isTmdbCdnUrl(src)}
					draggable={false}
				/>
			) : null}
		</div>
	);
}

/**
 * Fixed clone of the tapped poster. The front face is the show poster.
 * The back face is pre-rotated so rotateY 180 shows the season art upright.
 * `z-[252]` sits above the dialog host (`z-[250]`) and below Quick Log (`z-[255]`).
 */
function PosterFlightClone({
	pose,
	homeRadius,
	frontSrc,
	backSrc,
	onComplete,
	onLiveUpdate,
}: {
	pose: PosterFlightPose;
	homeRadius: number;
	frontSrc: string | null;
	backSrc: string | null;
	onComplete: () => void;
	/** Latest x/y/scale/rotateY/radius so a missing-cell fade can freeze, not fly. */
	onLiveUpdate: (live: DiaryTvPosterFlightLive) => void;
}) {
	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-0 z-[252]"
			style={{ perspective: "1200px" }}
		>
			<motion.div
				className="absolute"
				style={{
					left: pose.origin.left,
					top: pose.origin.top,
					width: pose.origin.width,
					height: pose.origin.height,
					transformStyle: "preserve-3d",
				}}
				initial={{
					x: 0,
					y: 0,
					scale: 1,
					rotateY: 0,
					opacity: 1,
					borderRadius: homeRadius,
				}}
				animate={{
					x: pose.x,
					y: pose.y,
					scale: pose.scale,
					rotateY: pose.rotateY,
					opacity: pose.opacity,
					borderRadius: pose.borderRadius,
				}}
				transition={{
					x: { duration: pose.moveDuration, ease: POSTER_FLIGHT_EASE },
					y: { duration: pose.moveDuration, ease: POSTER_FLIGHT_EASE },
					scale: { duration: pose.moveDuration, ease: POSTER_FLIGHT_EASE },
					rotateY: {
						duration: pose.moveDuration,
						ease: POSTER_FLIGHT_EASE,
					},
					borderRadius: {
						duration: pose.moveDuration,
						ease: POSTER_FLIGHT_EASE,
					},
					opacity: POSTER_FADE_TRANSITION,
				}}
				onUpdate={(latest) => {
					onLiveUpdate(
						readLiveFlightSample(latest, {
							x: pose.x,
							y: pose.y,
							scale: pose.scale,
							rotateY: pose.rotateY,
							borderRadius: pose.borderRadius,
						}),
					);
				}}
				onAnimationComplete={onComplete}
			>
				<PosterFlightFace src={frontSrc} side="front" />
				<PosterFlightFace src={backSrc} side="back" />
			</motion.div>
		</div>
	);
}

/**
 * Move a season group to the top of the episode list.
 * `scrollIntoView` would also scroll the page and the dialog shell.
 */
function scrollListToGroup(
	list: HTMLElement,
	group: HTMLElement,
	behavior: "auto" | "smooth",
) {
	const top =
		list.scrollTop +
		(group.getBoundingClientRect().top - list.getBoundingClientRect().top);
	if (behavior === "smooth") {
		list.scrollTo({ top, behavior: "smooth" });
		return;
	}
	list.scrollTop = top;
}

/**
 * Season whose group occupies the most of the list viewport.
 * Overlap is capped by the scroller, so a group taller than the list can still
 * be the primary visible season (a 0.45 ratio never reaches that).
 */
function primaryVisibleSeason(
	list: HTMLElement,
	groups: ReadonlyMap<number, HTMLElement>,
): number | null {
	const listRect = list.getBoundingClientRect();
	let bestSeason: number | null = null;
	let bestHeight = 0;
	let bestTop = Number.POSITIVE_INFINITY;
	for (const [season, node] of groups) {
		const rect = node.getBoundingClientRect();
		const top = Math.max(rect.top, listRect.top);
		const bottom = Math.min(rect.bottom, listRect.bottom);
		const height = Math.max(0, bottom - top);
		if (height <= 0) continue;
		if (height > bestHeight || (height === bestHeight && rect.top < bestTop)) {
			bestHeight = height;
			bestTop = rect.top;
			bestSeason = season;
		}
	}
	return bestSeason;
}

function loadingPillKeys(seasonNumber: number, episodeCount: number): string[] {
	const count = Math.max(episodeCount, 1);
	return Array.from(
		{ length: count },
		(_, slot) => `${seasonNumber}-loading-${slot + 1}`,
	);
}

/** Shared circle so legend swatches use the same shape as episode pills. */
const EPISODE_PILL_SHAPE_CLASSNAME =
	"inline-flex min-h-11 min-w-11 select-none items-center justify-center rounded-full px-3 text-sm tabular-nums";

function EpisodePill({
	pill,
	episodeNumber,
	onOpenLog,
}: {
	pill: DiaryTvPill;
	episodeNumber: number;
	onOpenLog: (latestLogId: string) => void;
}) {
	switch (pill.kind) {
		case "empty":
			return (
				<span
					className={cn(
						EPISODE_PILL_SHAPE_CLASSNAME,
						"font-medium text-muted-foreground",
					)}
				>
					{episodeNumber}
				</span>
			);
		case "neutral":
			return (
				<button
					type="button"
					aria-label={`Episode ${episodeNumber}`}
					className={cn(
						EPISODE_PILL_SHAPE_CLASSNAME,
						"cursor-pointer bg-background font-medium text-foreground",
					)}
					onClick={() => onOpenLog(pill.latestLogId)}
				>
					{episodeNumber}
				</button>
			);
		case "rated": {
			const score = formatLogRatingDisplay(pill.averageDisplay);
			return (
				<button
					type="button"
					aria-label={`Episode ${episodeNumber}, ${score}`}
					className={cn(
						EPISODE_PILL_SHAPE_CLASSNAME,
						"cursor-pointer font-semibold",
						ratedPillTextClass(pill.averageDisplay),
					)}
					style={{ background: ratedPillBackground(pill.averageDisplay) }}
					onClick={() => onOpenLog(pill.latestLogId)}
				>
					{score}
				</button>
			);
		}
		default: {
			const _exhaustive: never = pill;
			return _exhaustive;
		}
	}
}

function SeasonPosterThumb({
	src,
	label,
	active,
	onSelect,
}: {
	src: string | null;
	label: string;
	active: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			aria-current={active ? "true" : undefined}
			aria-label={label}
			className={cn(
				"relative aspect-2/3 min-h-11 w-11 cursor-pointer select-none overflow-hidden rounded-lg bg-background",
				active ? "opacity-100" : "opacity-50",
			)}
			onClick={onSelect}
		>
			{src ? (
				<Image
					src={src}
					alt=""
					fill
					sizes="44px"
					className="object-cover"
					unoptimized={isTmdbCdnUrl(src)}
				/>
			) : (
				<span className="grid size-full place-items-center px-1 text-center text-[10px] text-muted-foreground leading-tight">
					{label}
				</span>
			)}
		</button>
	);
}

function LegendSwatch({
	label,
	background,
	className,
	children,
}: {
	label: string;
	background?: string;
	className?: string;
	children: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<span
				aria-hidden
				className={cn(EPISODE_PILL_SHAPE_CLASSNAME, className)}
				style={background ? { background } : undefined}
			>
				{children}
			</span>
			<span className="text-muted-foreground text-xs">{label}</span>
		</div>
	);
}

export function DiaryTvEpisodeDialog({
	open,
	onOpenChange,
	tmdbId,
	title,
	posterPath,
	cellRef,
	cellInGrid,
	onConcealPoster,
	onExitComplete,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	title: string;
	posterPath: string | null;
	/** Grid cell root. Measured on open and again on close for the poster flight. */
	cellRef: RefObject<HTMLElement | null>;
	/**
	 * False when this show left the grid. The dialog stays mounted and fades
	 * instead of flying home.
	 */
	cellInGrid: boolean;
	/**
	 * Hides the grid poster while the clone is in flight or the dialog is open.
	 * `false` only after the flight home finishes. Reduced motion stays `false`.
	 */
	onConcealPoster: (concealed: boolean) => void;
	/** Flight home or missing-cell fade finished. The lobby may open the next show. */
	onExitComplete: () => void;
}) {
	const titleId = useId();
	const reduceMotion = useReducedMotion() === true;
	const openQuickLog = useQuickLog((s) => s.open);
	const quickLogOpen = useQuickLog((s) => s.isOpen);
	const [mounted, setMounted] = useState(false);
	const [logRows, setLogRows] = useState<DiaryLogRow[]>([]);
	const [seasons, setSeasons] = useState<TvSeasonSummary[]>([]);
	const [episodesBySeason, setEpisodesBySeason] = useState<
		Record<number, TvEpisodeSummary[]>
	>({});
	const [seasonFailed, setSeasonFailed] = useState<Record<number, boolean>>({});
	const [activeSeason, setActiveSeason] = useState<number | null>(null);
	const [seasonsError, setSeasonsError] = useState(false);
	const [diaryError, setDiaryError] = useState(false);
	const [seasonsLoading, setSeasonsLoading] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);
	const groupRefs = useRef(new Map<number, HTMLElement>());
	// Poster taps scroll the list; ignore overlap sync until that scroll settles.
	const skipScrollSyncRef = useRef(false);
	// Opening season stays put until the patron scrolls the list themselves.
	const seasonSyncLockedRef = useRef(true);
	const didInitialSeasonScrollRef = useRef(false);
	// False while a reopen still holds the previous season, until loadCatalogue picks one.
	const openingSeasonAppliedRef = useRef(false);
	const slotRef = useRef<HTMLDivElement>(null);
	// Stays mounted through the flight home after `open` flips false.
	const [alive, setAlive] = useState(false);
	const [chromeOn, setChromeOn] = useState(false);
	const [chromeDelay, setChromeDelay] = useState(0);
	const [pose, setPose] = useState<PosterFlightPose | null>(null);
	const poseRef = useRef<PosterFlightPose | null>(null);
	poseRef.current = pose;
	const liveFlightRef = useRef<DiaryTvPosterFlightLive | null>(null);
	const originRef = useRef<FlightRect | null>(null);
	const homeRadiusRef = useRef(0);
	const sessionRef = useRef<"idle" | "open">("idle");
	const closingRef = useRef(false);
	const closeStartedAtRef = useRef(0);
	const closeDurationMsRef = useRef(0);
	const closeTimerRef = useRef<number | null>(null);
	// True only after the open path runs. A dismiss before that still has to
	// tell the lobby, or the session stays on "closing" with no dialog.
	const openedRef = useRef(false);
	const exitReportedRef = useRef(false);
	const onConcealPosterRef = useRef(onConcealPoster);
	onConcealPosterRef.current = onConcealPoster;
	const onExitCompleteRef = useRef(onExitComplete);
	onExitCompleteRef.current = onExitComplete;
	const cellInGridRef = useRef(cellInGrid);
	cellInGridRef.current = cellInGrid;

	const episodeLogs = useMemo(
		() => (diaryError ? [] : episodeLogsFromRows(logRows)),
		[diaryError, logRows],
	);
	const seriesLabel = useMemo(() => showLogLabel(episodeLogs), [episodeLogs]);
	const activeSeasonRow = seasons.find(
		(season) => season.season_number === activeSeason,
	);
	const largePosterSrc = seasonPosterSrc(
		activeSeasonRow?.poster_path,
		posterPath,
	);

	useEffect(() => {
		setMounted(true);
	}, []);

	const clearCloseTimer = useCallback(() => {
		if (closeTimerRef.current == null) return;
		window.clearTimeout(closeTimerRef.current);
		closeTimerRef.current = null;
	}, []);

	const finishClose = useCallback(() => {
		if (!closingRef.current) return;
		closingRef.current = false;
		clearCloseTimer();
		originRef.current = null;
		closeDurationMsRef.current = 0;
		liveFlightRef.current = null;
		onConcealPosterRef.current(false);
		setPose(null);
		setChromeOn(false);
		setChromeDelay(0);
		setAlive(false);
		if (exitReportedRef.current) return;
		exitReportedRef.current = true;
		onExitCompleteRef.current();
	}, [clearCloseTimer]);

	const maybeFinishClose = useCallback(() => {
		if (!closingRef.current) return;
		const elapsed = performance.now() - closeStartedAtRef.current;
		// Ignore a completion from the open trip if close started a newer animation.
		if (elapsed + 32 < closeDurationMsRef.current) return;
		finishClose();
	}, [finishClose]);

	const armCloseTimer = useCallback(
		(durationS: number) => {
			clearCloseTimer();
			closeStartedAtRef.current = performance.now();
			closeDurationMsRef.current = durationS * 1000;
			closeTimerRef.current = window.setTimeout(() => {
				maybeFinishClose();
			}, closeDurationMsRef.current + 40);
		},
		[clearCloseTimer, maybeFinishClose],
	);

	// Fade in place. Does not retarget the clone at a cell.
	const beginFadeClose = useCallback(() => {
		const current = poseRef.current;
		const alreadyFading =
			closingRef.current && (current == null || current.opacity === 0);
		sessionRef.current = "idle";
		closingRef.current = true;
		setChromeDelay(0);
		setChromeOn(false);
		if (current && current.opacity !== 0) {
			// Freeze at the live transform. Do not keep flying (or snap) to the cell.
			setPose(freezePosterFlightForFade(current, liveFlightRef.current));
		} else if (!current) {
			setPose(null);
		}
		if (!alreadyFading) armCloseTimer(POSTER_CHROME_FADE_S);
	}, [armCloseTimer]);

	useEffect(() => clearCloseTimer, [clearCloseTimer]);

	// The cell left after the flight home started. Fade the dialog that is
	// already mounted — do not send the clone to a missing rect.
	useLayoutEffect(() => {
		if (!mounted || open || !closingRef.current) return;
		const cellNode = cellRef.current;
		if (cellInGrid && cellCanReceivePoster(cellNode)) return;
		beginFadeClose();
	}, [beginFadeClose, cellInGrid, cellRef, mounted, open]);

	// Measure before paint so the clone is already on the cell when the first frame shows.
	useLayoutEffect(() => {
		if (!mounted) return;
		if (open) {
			if (sessionRef.current === "open") return;
			openedRef.current = true;
			exitReportedRef.current = false;
			sessionRef.current = "open";
			closingRef.current = false;
			clearCloseTimer();
			setAlive(true);

			const cellNode = cellRef.current;
			const slotNode = slotRef.current;
			const canFly =
				!reduceMotion &&
				cellNode != null &&
				slotNode != null &&
				cellNode.getBoundingClientRect().width > 0 &&
				slotNode.getBoundingClientRect().width > 0;

			if (!canFly || !cellNode || !slotNode) {
				originRef.current = null;
				setPose(null);
				setChromeDelay(0);
				setChromeOn(true);
				onConcealPosterRef.current(false);
				return;
			}

			const cell = readFlightRect(cellNode);
			// Keep the opening origin if a close was interrupted so the clone doesn't jump.
			const origin = originRef.current ?? cell;
			originRef.current = origin;
			const slot = readFlightRect(slotNode);
			const art = cellNode.querySelector(".poster-art");
			const cellRadius =
				art instanceof HTMLElement ? readCornerRadius(art, 48) : 48;
			// A fresh clone mounts from this radius. An in-flight clone keeps its initial.
			if (!poseRef.current) homeRadiusRef.current = cellRadius;
			const slotRadius = readCornerRadius(slotNode, 20);
			const delta = flightDelta(origin, slot);
			onConcealPosterRef.current(true);
			setChromeDelay(POSTER_CHROME_DELAY_S);
			setChromeOn(true);
			if (!poseRef.current) liveFlightRef.current = null;
			setPose({
				origin,
				x: delta.x,
				y: delta.y,
				scale: delta.scale,
				rotateY: 180,
				borderRadius: localRadius(slotRadius, delta.scale),
				opacity: 1,
				moveDuration: POSTER_FLIGHT_S,
			});
			return;
		}

		if (sessionRef.current !== "open") {
			// Dismissed before the open session existed. Nothing is in flight.
			if (!openedRef.current && !exitReportedRef.current) {
				exitReportedRef.current = true;
				onExitCompleteRef.current();
			}
			return;
		}

		const origin = originRef.current;
		const cellNode = cellRef.current;
		const current = poseRef.current;
		const closeKind = diaryTvPosterCloseKind({
			reduceMotion,
			cellInGrid: cellInGridRef.current,
			cellConnected: cellCanReceivePoster(cellNode),
			hasOrigin: origin != null,
			hasPose: current != null,
		});
		if (closeKind === "fade" || !origin || !cellNode || !current) {
			// No cell, the show left the grid, or reduced motion: fade. Do not fly.
			beginFadeClose();
			return;
		}

		sessionRef.current = "idle";
		closingRef.current = true;
		setChromeDelay(0);
		setChromeOn(false);

		const cell = readFlightRect(cellNode);
		const art = cellNode.querySelector(".poster-art");
		const cellRadius =
			art instanceof HTMLElement
				? readCornerRadius(art, homeRadiusRef.current || 48)
				: homeRadiusRef.current || 48;
		const delta = flightDelta(origin, cell);
		setPose({
			origin,
			x: delta.x,
			y: delta.y,
			scale: delta.scale,
			rotateY: 0,
			borderRadius: localRadius(cellRadius, delta.scale),
			opacity: 1,
			moveDuration: POSTER_FLIGHT_S,
		});
		armCloseTimer(POSTER_FLIGHT_S);
	}, [
		armCloseTimer,
		beginFadeClose,
		cellRef,
		clearCloseTimer,
		mounted,
		open,
		reduceMotion,
	]);

	// The centered dialog grows when seasons arrive, so the slot moves after the
	// opening measure. Stick the landed clone to the slot without starting another flip.
	useEffect(() => {
		if (!open) return;
		const slotNode = slotRef.current;
		if (!slotNode) return;
		const syncToSlot = () => {
			if (closingRef.current) return;
			const origin = originRef.current;
			const current = poseRef.current;
			if (!origin || !current || current.rotateY !== 180) return;
			const slot = readFlightRect(slotNode);
			const delta = flightDelta(origin, slot);
			if (
				Math.abs(delta.x - current.x) < 0.5 &&
				Math.abs(delta.y - current.y) < 0.5 &&
				Math.abs(delta.scale - current.scale) < 0.002
			) {
				return;
			}
			setPose({
				origin: current.origin,
				x: delta.x,
				y: delta.y,
				scale: delta.scale,
				rotateY: 180,
				borderRadius: localRadius(readCornerRadius(slotNode, 20), delta.scale),
				opacity: 1,
				moveDuration: 0,
			});
		};
		const observer = new ResizeObserver(syncToSlot);
		observer.observe(slotNode);
		const dialog = slotNode.closest("[role='dialog']");
		if (dialog instanceof HTMLElement) observer.observe(dialog);
		return () => observer.disconnect();
	}, [open]);

	const applyDiaryResult = useCallback(
		(data: unknown, failed: boolean) => {
			if (failed) {
				setDiaryError(true);
				setLogRows([]);
				return;
			}
			setDiaryError(false);
			setLogRows(tvLogsToDiaryRows(data, tmdbId, title, posterPath));
		},
		[posterPath, title, tmdbId],
	);

	const loadSeasonEpisodes = useCallback(
		async (seasonNumber: number, signal?: AbortSignal) => {
			setSeasonFailed((prev) => ({ ...prev, [seasonNumber]: false }));
			try {
				const result = await fetchTvSeasonDetail(tmdbId, seasonNumber, {
					signal,
				});
				if (signal?.aborted) return;
				const episodes = result.data?.season?.episodes;
				if (result.error || !episodes) {
					setSeasonFailed((prev) => ({ ...prev, [seasonNumber]: true }));
					return;
				}
				const ordered = [...episodes].sort(
					(a, b) => a.episode_number - b.episode_number,
				);
				setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: ordered }));
			} catch (error) {
				if (isAbortError(error) || signal?.aborted) return;
				setSeasonFailed((prev) => ({ ...prev, [seasonNumber]: true }));
			}
		},
		[tmdbId],
	);

	const loadCatalogue = useCallback(
		async (signal: AbortSignal) => {
			setSeasonsLoading(true);
			setSeasonsError(false);
			setSeasons([]);
			setEpisodesBySeason({});
			setSeasonFailed({});
			openingSeasonAppliedRef.current = false;
			setActiveSeason(null);

			const [logsOutcome, seasonsOutcome] = await Promise.all([
				fetchMyLogsForTv(tmdbId, { signal }).catch((error: unknown) => {
					if (isAbortError(error)) return null;
					return { data: null, error: { status: 0 } };
				}),
				fetchTvSeasons(tmdbId, { signal }).catch((error: unknown) => {
					if (isAbortError(error)) return null;
					return { data: null, error: { status: 0 } };
				}),
			]);
			if (signal.aborted) return;

			if (
				!logsOutcome ||
				logsOutcome.error ||
				!Array.isArray(logsOutcome.data)
			) {
				applyDiaryResult(null, true);
			} else {
				applyDiaryResult(logsOutcome.data, false);
			}

			if (
				!seasonsOutcome ||
				seasonsOutcome.error ||
				!seasonsOutcome.data?.seasons
			) {
				setSeasonsError(true);
				setSeasonsLoading(false);
				return;
			}

			const usable = seasonsOutcome.data.seasons
				.filter((season) => season.episode_count > 0)
				.sort((a, b) => a.season_number - b.season_number);
			setSeasons(usable);
			setSeasonsLoading(false);

			const diaryRows = Array.isArray(logsOutcome?.data)
				? tvLogsToDiaryRows(logsOutcome.data, tmdbId, title, posterPath)
				: [];
			const nextActive = initialSeasonNumber(
				episodeLogsFromRows(diaryRows),
				usable.map((season) => season.season_number),
			);
			openingSeasonAppliedRef.current = true;
			setActiveSeason(nextActive);

			// Active season first so its pills paint before the rest of the catalogue.
			if (nextActive != null) {
				await loadSeasonEpisodes(nextActive, signal);
			}
			if (signal.aborted) return;
			const remaining = usable.filter(
				(season) => season.season_number !== nextActive,
			);
			await Promise.all(
				remaining.map((season) =>
					loadSeasonEpisodes(season.season_number, signal),
				),
			);
		},
		[applyDiaryResult, loadSeasonEpisodes, posterPath, title, tmdbId],
	);

	useEffect(() => {
		if (!open) return;
		const controller = new AbortController();
		void loadCatalogue(controller.signal);
		return () => {
			controller.abort();
		};
	}, [loadCatalogue, open]);

	const refetchDiary = useCallback(async () => {
		try {
			const result = await fetchMyLogsForTv(tmdbId);
			if (result.error || !Array.isArray(result.data)) {
				applyDiaryResult(null, true);
				return;
			}
			applyDiaryResult(result.data, false);
		} catch {
			applyDiaryResult(null, true);
		}
	}, [applyDiaryResult, tmdbId]);

	const retrySeasons = useCallback(() => {
		void loadCatalogue(new AbortController().signal);
	}, [loadCatalogue]);

	const close = useCallback(() => {
		onOpenChange(false);
	}, [onOpenChange]);

	useEffect(() => {
		// Quick Log has its own Escape. Listening here too would dismiss the dialog
		// underneath the sheet.
		// Also listen while the flight home is still mounted (`alive`), so Escape
		// can drop a queued poster. It must not toggle the dialog open again.
		if ((!open && !alive) || quickLogOpen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [alive, close, open, quickLogOpen]);

	useEffect(() => {
		// Keep the lobby still through the flight home, after `open` is already false.
		if (!open && !alive) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [alive, open]);

	const selectSeason = useCallback((seasonNumber: number) => {
		setActiveSeason(seasonNumber);
		skipScrollSyncRef.current = true;
		const list = listRef.current;
		const group = groupRefs.current.get(seasonNumber);
		if (list && group) {
			scrollListToGroup(list, group, "smooth");
		}
		window.setTimeout(() => {
			skipScrollSyncRef.current = false;
		}, 400);
	}, []);

	// Open on `initialSeasonNumber` and scroll that group into view. Overlap sync
	// stays locked so the first layout pass cannot replace the opening season.
	useLayoutEffect(() => {
		if (!open) {
			didInitialSeasonScrollRef.current = false;
			seasonSyncLockedRef.current = true;
			openingSeasonAppliedRef.current = false;
			return;
		}
		// Ignore a season left over from the previous open until loadCatalogue applies one.
		if (
			!openingSeasonAppliedRef.current ||
			didInitialSeasonScrollRef.current ||
			activeSeason == null ||
			seasons.length === 0
		) {
			return;
		}
		const list = listRef.current;
		const group = groupRefs.current.get(activeSeason);
		if (!list || !group) return;
		didInitialSeasonScrollRef.current = true;
		seasonSyncLockedRef.current = true;
		scrollListToGroup(list, group, "auto");
	}, [open, activeSeason, seasons]);

	// After the patron scrolls the list, the group with the most visible height
	// becomes the active season. A wheel/touch/pointer gesture unlocks sync so the
	// opening scroll itself does not count.
	useEffect(() => {
		if (!open || seasons.length === 0) return;
		const list = listRef.current;
		if (!list) return;
		const unlock = () => {
			seasonSyncLockedRef.current = false;
		};
		const syncFromScroll = () => {
			if (seasonSyncLockedRef.current || skipScrollSyncRef.current) return;
			const next = primaryVisibleSeason(list, groupRefs.current);
			if (next == null) return;
			setActiveSeason((prev) => (prev === next ? prev : next));
		};
		list.addEventListener("wheel", unlock, { passive: true });
		list.addEventListener("touchmove", unlock, { passive: true });
		list.addEventListener("pointerdown", unlock);
		list.addEventListener("scroll", syncFromScroll, { passive: true });
		return () => {
			list.removeEventListener("wheel", unlock);
			list.removeEventListener("touchmove", unlock);
			list.removeEventListener("pointerdown", unlock);
			list.removeEventListener("scroll", syncFromScroll);
		};
	}, [open, seasons]);

	const openLatestLog = useCallback(
		(latestLogId: string) => {
			const row = logRows.find((entry) => entry.log.id === latestLogId);
			if (!row) return;
			const payload = diaryLogToQuickLogOpenPayload(row, () => {
				void refetchDiary();
			});
			if (payload) openQuickLog({ ...payload, aboveAppModal: true });
		},
		[logRows, openQuickLog, refetchDiary],
	);

	if (!mounted || (!open && !alive)) return null;

	const showPosterSrc = tmdbPosterUrlFromPath(posterPath, "w342");

	const portal = (
		<>
			{pose ? (
				<PosterFlightClone
					pose={pose}
					homeRadius={homeRadiusRef.current || pose.borderRadius}
					frontSrc={showPosterSrc}
					backSrc={largePosterSrc}
					onComplete={maybeFinishClose}
					onLiveUpdate={(live) => {
						liveFlightRef.current = live;
					}}
				/>
			) : null}
			<motion.div
				className="fixed inset-0 z-[250]"
				initial={{ opacity: 0 }}
				animate={{ opacity: chromeOn ? 1 : 0 }}
				transition={{
					duration: POSTER_CHROME_FADE_S,
					delay: chromeDelay,
					ease: POSTER_FLIGHT_EASE,
				}}
				onAnimationComplete={maybeFinishClose}
			>
				{/* Scrim is a real button so Escape-or-click close stays keyboard-reachable. */}
				<button
					type="button"
					aria-label="Close"
					className={cn(APP_MODAL_OVERLAY_CLASS, "px-4 py-6")}
					onClick={close}
				/>
				<div className="pointer-events-none fixed inset-0 z-[250] grid min-h-[100dvh] place-items-end overflow-y-auto px-4 py-6 md:place-items-center">
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						className="pointer-events-auto relative flex max-h-[min(88svh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-card"
					>
						<button
							type="button"
							aria-label="Close"
							className={cn(
								"absolute top-3 right-3 z-10 inline-flex min-h-11 min-w-11 cursor-pointer select-none items-center justify-center rounded-full bg-background text-muted-foreground",
								DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							)}
							onClick={close}
						>
							<X className="size-4" aria-hidden />
						</button>

						<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6 pt-14 sm:flex-row">
							<aside className="flex w-full shrink-0 flex-col gap-3 sm:w-44">
								<div
									ref={slotRef}
									data-diary-flight-slot
									className="relative aspect-2/3 w-full overflow-hidden rounded-[1.25rem] bg-background"
								>
									{largePosterSrc ? (
										<Image
											src={largePosterSrc}
											alt=""
											fill
											sizes="(max-width:640px) 80vw, 176px"
											className={cn(
												"object-cover",
												// The clone is the poster until the flight home unmounts it.
												pose ? "invisible" : undefined,
											)}
											unoptimized={isTmdbCdnUrl(largePosterSrc)}
											priority
										/>
									) : null}
								</div>
								{seriesLabel ? (
									<p className="text-pretty font-medium text-foreground text-sm">
										{seriesLabel}
									</p>
								) : null}
								<div className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden">
									{seasons.map((season) => (
										<SeasonPosterThumb
											key={season.id}
											src={seasonPosterSrc(season.poster_path, posterPath)}
											label={season.name || `Season ${season.season_number}`}
											active={season.season_number === activeSeason}
											onSelect={() => selectSeason(season.season_number)}
										/>
									))}
								</div>
							</aside>

							<div
								ref={listRef}
								className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							>
								<h2
									id={titleId}
									className="text-balance font-semibold text-foreground text-lg tracking-tight"
								>
									{title}
								</h2>

								{seasonsError ? (
									<div className="flex flex-col items-start gap-3">
										<p className="text-muted-foreground text-sm">
											Couldn’t load episodes
										</p>
										<button
											type="button"
											className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full bg-background px-4 font-medium text-sm"
											onClick={retrySeasons}
										>
											Try again
										</button>
									</div>
								) : null}

								{diaryError ? (
									<div className="flex flex-col items-start gap-3">
										<p className="text-muted-foreground text-sm">
											Couldn’t load diary entries
										</p>
										<button
											type="button"
											className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full bg-background px-4 font-medium text-sm"
											onClick={() => {
												void refetchDiary();
											}}
										>
											Try again
										</button>
									</div>
								) : null}

								{seasonsLoading && !seasonsError
									? (["left", "right"] as const).map((slot) => (
											<div
												key={`season-bone-${slot}`}
												className="rounded-[1.25rem] bg-background p-4"
											>
												<div className="flex flex-wrap gap-2">
													{(["a", "b", "c", "d", "e", "f"] as const).map(
														(pillSlot) => (
															<span
																key={`bone-${slot}-${pillSlot}`}
																className="h-11 w-11 animate-pulse rounded-full bg-card"
															/>
														),
													)}
												</div>
											</div>
										))
									: null}

								{seasons.map((season) => {
									const seasonNumber = season.season_number;
									const episodes = episodesBySeason[seasonNumber];
									const failed = seasonFailed[seasonNumber] === true;
									const score = seasonLogScoreLabel(seasonNumber, episodeLogs);
									const name = season.name || `Season ${seasonNumber}`;
									return (
										<section
											key={season.id}
											ref={(node) => {
												if (node) groupRefs.current.set(seasonNumber, node);
												else groupRefs.current.delete(seasonNumber);
											}}
											data-season-number={seasonNumber}
											className="rounded-[1.25rem] bg-background p-4"
										>
											<header className="mb-3 text-pretty font-medium text-sm">
												{name}
												{score ? (
													<span className="text-muted-foreground">
														{" "}
														· {score}
													</span>
												) : null}
											</header>
											{failed ? (
												<button
													type="button"
													className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full bg-card px-4 font-medium text-sm"
													onClick={() => {
														void loadSeasonEpisodes(seasonNumber);
													}}
												>
													Try again
												</button>
											) : episodes == null ? (
												<div className="flex flex-wrap gap-2">
													{loadingPillKeys(
														seasonNumber,
														season.episode_count,
													).map((pillKey) => (
														<span
															key={pillKey}
															className="h-11 w-11 animate-pulse rounded-full bg-card"
														/>
													))}
												</div>
											) : (
												<div className="flex flex-wrap gap-2">
													{episodes.map((episode) => (
														<EpisodePill
															key={episode.id}
															episodeNumber={episode.episode_number}
															pill={pillForEpisode(
																{
																	seasonNumber,
																	episodeNumber: episode.episode_number,
																},
																episodeLogs,
															)}
															onOpenLog={openLatestLog}
														/>
													))}
												</div>
											)}
										</section>
									);
								})}

								{!seasonsError && seasons.length > 0 ? (
									<div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 pb-2">
										<LegendSwatch
											label="Not logged"
											className="font-medium text-muted-foreground"
										>
											1
										</LegendSwatch>
										<LegendSwatch
											label="Watched, no rating"
											className="bg-background font-medium text-foreground"
										>
											1
										</LegendSwatch>
										<LegendSwatch
											label="0"
											background={ratedPillBackground(0)}
											className={cn("font-semibold", ratedPillTextClass(0))}
										>
											{formatLogRatingDisplay(0)}
										</LegendSwatch>
										<LegendSwatch
											label="5"
											background={ratedPillBackground(5)}
											className={cn("font-semibold", ratedPillTextClass(5))}
										>
											{formatLogRatingDisplay(5)}
										</LegendSwatch>
										<LegendSwatch
											label="10"
											background={ratedPillBackground(10)}
											className={cn("font-semibold", ratedPillTextClass(10))}
										>
											{formatLogRatingDisplay(10)}
										</LegendSwatch>
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</motion.div>
		</>
	);

	return createPortal(portal, document.body);
}
