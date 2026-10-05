"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronDown, X } from "lucide-react";
import { animate, motion, useAnimation, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import {
	type ReactNode,
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
import {
	type DiaryTvCardBox,
	type DiaryTvCardMorph,
	morphFade,
	morphFromCell,
	morphHome,
	morphToPanel,
	posterBoxInsideCard,
} from "@/lib/diary-tv-card-morph";
import { diaryTvPosterCloseKind } from "@/lib/diary-tv-episode-dialog-session";
import {
	type DiaryTvEpisodeLog,
	type DiaryTvPill,
	EPISODE_SCORE_LEGEND,
	episodeBarHeightPx,
	episodeScoreBandFill,
	initialSeasonNumber,
	pillForEpisode,
	seasonEpisodeAverage,
	seasonLogScoreLabel,
	showLogLabel,
} from "@/lib/diary-tv-episode-pills";
import { cellCanReceivePoster } from "@/lib/diary-tv-poster-flight";
import { formatLogRatingDisplay } from "@/lib/log-rating";
import type { MyTvLog } from "@/lib/my-tv-log";
import {
	fetchMyLogsForTv,
	fetchTvSeasonDetail,
	fetchTvSeasons,
} from "@/lib/still-api-fetch";
import { isTmdbCdnUrl, tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import type { TvEpisodeSummary, TvSeasonSummary } from "@/lib/tv-watch-types";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

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

const POSTER_FLY_S = 0.45;
const THUMB_RADIUS_PX = 8;
const SLOT_RADIUS_PX = 20;

/** `"show"` is the diary series poster. A number is that season's poster. */
type DiaryPosterKey = "show" | number;

function posterKeyArt(
	key: DiaryPosterKey,
	seasons: readonly TvSeasonSummary[],
	posterPath: string | null,
): { src: string | null; label: string } {
	if (key === "show") {
		return {
			src: tmdbPosterUrlFromPath(posterPath, "w342"),
			label: "Whole series",
		};
	}
	const season = seasons.find((entry) => entry.season_number === key);
	return {
		src: seasonPosterSrc(season?.poster_path, posterPath),
		label: season?.name || `Season ${key}`,
	};
}

/** Arc between the large poster and a bottom thumb. One progress value drives the whole path. */
function posterFlyFrame(
	from: DOMRect,
	to: DOMRect,
	t: number,
	radiusFrom: number,
	radiusTo: number,
) {
	const lift = Math.min(
		72,
		Math.max(28, Math.abs(from.top - to.top) * 0.45 + 16),
	);
	const u = 1 - t;
	const fromCx = from.left + from.width / 2;
	const fromCy = from.top + from.height / 2;
	const toCx = to.left + to.width / 2;
	const toCy = to.top + to.height / 2;
	const midCx = (fromCx + toCx) / 2;
	const midCy = Math.min(fromCy, toCy) - lift;
	const cx = u * u * fromCx + 2 * u * t * midCx + t * t * toCx;
	const cy = u * u * fromCy + 2 * u * t * midCy + t * t * toCy;
	const width = from.width + (to.width - from.width) * t;
	const height = from.height + (to.height - from.height) * t;
	return {
		left: cx - width / 2,
		top: cy - height / 2,
		width,
		height,
		radius: radiusFrom + (radiusTo - radiusFrom) * t,
	};
}

type DiaryTvPosterFlightLeg = {
	src: string;
	from: DOMRect;
	to: DOMRect;
	radiusFrom: number;
	radiusTo: number;
};

type DiaryTvPosterSwap = {
	token: number;
	incoming: DiaryTvPosterFlightLeg;
	outgoing: DiaryTvPosterFlightLeg;
	nextFocused: DiaryPosterKey;
	nextRow: DiaryPosterKey[];
};

/** The card grows on width and height together. Content fades in as that finishes. */
const CARD_MORPH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const CARD_MORPH_S = 0.45;
const CARD_CONTENT_FADE_S = 0.2;

function readCornerRadius(node: HTMLElement, fallback: number): number {
	const radius = Number.parseFloat(getComputedStyle(node).borderTopLeftRadius);
	return Number.isFinite(radius) ? radius : fallback;
}

function readCardBox(
	node: HTMLElement,
	fallbackRadius: number,
): DiaryTvCardBox {
	const rect = node.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
		radius: readCornerRadius(node, fallbackRadius),
	};
}

/** The visible poster frame, so the card starts on the art and not the cell padding. */
function readCellPosterBox(cell: HTMLElement): DiaryTvCardBox {
	const art = cell.querySelector(".poster-art");
	return readCardBox(art instanceof HTMLElement ? art : cell, 48);
}

/** Sum of the children, so a stretched flex item does not report the card's own height. */
function contentBlockHeight(node: HTMLElement): number {
	let total = 0;
	for (const child of node.children) {
		if (!(child instanceof HTMLElement)) continue;
		// A squeezed scroller still reports its content through scrollHeight.
		total += Math.max(child.offsetHeight, child.scrollHeight);
	}
	const gap = Number.parseFloat(getComputedStyle(node).rowGap);
	const gaps =
		Math.max(0, node.children.length - 1) * (Number.isFinite(gap) ? gap : 0);
	return total + gaps;
}

/**
 * Height the card needs once episodes are in the DOM.
 * Reads the blocks inside the list, not the clipped or stretched box.
 */
function readNaturalCardHeight(panel: HTMLElement): number {
	const list = panel.querySelector("[data-diary-card-list]");
	const aside = panel.querySelector("[data-diary-card-aside]");
	const heading = panel.querySelector("[data-diary-card-heading]");
	const listHeight = list instanceof HTMLElement ? contentBlockHeight(list) : 0;
	const asideHeight =
		aside instanceof HTMLElement ? contentBlockHeight(aside) : 0;
	const headingHeight =
		heading instanceof HTMLElement ? heading.offsetHeight : 0;
	// Title row sits above the episode list with `gap-4`.
	const rightHeight =
		headingHeight > 0 ? headingHeight + 16 + listHeight : listHeight;
	// Body padding is `p-6` on the top and the bottom.
	const pad = 24 + 24;
	const cap = Math.min(window.innerHeight * 0.88, 52 * 16);
	return Math.min(Math.max(rightHeight, asideHeight) + pad, cap);
}

/** Poster box relative to the card, read from the element that is actually on screen. */
function readPosterInside(panel: HTMLElement): DiaryTvCardBox | null {
	const node = panel.querySelector("[data-diary-card-poster]");
	if (!(node instanceof HTMLElement)) return null;
	const card = panel.getBoundingClientRect();
	const poster = node.getBoundingClientRect();
	if (poster.width <= 0 || poster.height <= 0) return null;
	return {
		left: poster.left - card.left,
		top: poster.top - card.top,
		width: poster.width,
		height: poster.height,
		radius: readCornerRadius(node, 20),
	};
}

function cardMotionBox(morph: DiaryTvCardMorph) {
	return {
		left: morph.card.left,
		top: morph.card.top,
		width: morph.card.width,
		height: morph.card.height,
		borderRadius: morph.card.radius,
		opacity: morph.cardOpacity,
	};
}

/**
 * Resting dialog sits in the centered grid. While morphing, the same card is
 * `position: fixed` and its box animates from the poster to that rectangle.
 * The card element stays mounted so season panels do not remount when the
 * grow finishes — a remount snapped the open season shut and played it again.
 */
function DiaryTvCardFrame({
	morph,
	from,
	panelRef,
	posterSrc,
	titleId,
	children,
}: {
	morph: DiaryTvCardMorph | null;
	/** Where a morph starts when it leaves the resting layout. */
	from: DiaryTvCardMorph | null;
	panelRef: RefObject<HTMLDivElement | null>;
	posterSrc: string | null;
	titleId: string;
	children: ReactNode;
}) {
	const cardControls = useAnimation();
	const contentControls = useAnimation();
	const restingRef = useRef(true);

	useLayoutEffect(() => {
		if (!morph) {
			restingRef.current = true;
			void cardControls.set({
				left: 0,
				top: 0,
				width: "100%",
				height: "auto",
				borderRadius: 32,
				opacity: 1,
			});
			void contentControls.set({ opacity: 1 });
			return;
		}

		const leavingRest = restingRef.current;
		restingRef.current = false;
		if (leavingRest && from) {
			// Jump to the poster, or the resting rect on close, before the tween.
			void cardControls.set(cardMotionBox(from));
			void contentControls.set({ opacity: from.contentOpacity });
		}

		if (morph.duration <= 0) {
			void cardControls.set(cardMotionBox(morph));
			void contentControls.set({ opacity: morph.contentOpacity });
			return;
		}

		void cardControls.start({
			...cardMotionBox(morph),
			transition: {
				duration: morph.duration,
				ease: CARD_MORPH_EASE,
				opacity: {
					duration:
						morph.cardOpacity === 0 ? CARD_CONTENT_FADE_S : morph.duration,
					ease: CARD_MORPH_EASE,
				},
			},
		});
		void contentControls.start({
			opacity: morph.contentOpacity,
			transition: {
				duration: CARD_CONTENT_FADE_S,
				delay:
					leavingRest && morph.contentOpacity > 0
						? CARD_MORPH_S - CARD_CONTENT_FADE_S
						: 0,
				ease: CARD_MORPH_EASE,
			},
		});
	}, [cardControls, contentControls, from, morph]);

	const posterFrom = from ?? morph;

	return (
		<div
			className={cn(
				"pointer-events-none fixed inset-0 z-[250]",
				morph
					? undefined
					: "grid min-h-[100dvh] place-items-end overflow-y-auto px-4 py-6 md:place-items-center",
			)}
		>
			<motion.div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				className={cn(
					"pointer-events-auto flex max-h-[min(88svh,52rem)] flex-col overflow-hidden bg-card",
					morph ? "fixed z-[1]" : "relative w-full max-w-5xl rounded-[2rem]",
				)}
				initial={false}
				animate={cardControls}
			>
				{morph && posterFrom ? (
					<motion.div
						aria-hidden
						data-diary-card-poster
						className="pointer-events-none absolute z-0 overflow-hidden"
						initial={{
							left: posterFrom.poster.left,
							top: posterFrom.poster.top,
							width: posterFrom.poster.width,
							height: posterFrom.poster.height,
							borderRadius: posterFrom.poster.radius,
						}}
						animate={{
							left: morph.poster.left,
							top: morph.poster.top,
							width: morph.poster.width,
							height: morph.poster.height,
							borderRadius: morph.poster.radius,
						}}
						transition={{ duration: morph.duration, ease: CARD_MORPH_EASE }}
					>
						{posterSrc ? (
							<Image
								src={posterSrc}
								alt=""
								fill
								sizes="(max-width:640px) 80vw, 176px"
								className="object-cover"
								unoptimized={isTmdbCdnUrl(posterSrc)}
								priority
							/>
						) : null}
					</motion.div>
				) : null}
				<motion.div
					className="relative z-[1] flex min-h-0 flex-1 flex-col"
					initial={false}
					animate={contentControls}
				>
					{children}
				</motion.div>
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

/** Plot box. Tiles grow from the baseline and stay inside this height. */
const EPISODE_CHART_PLOT_PX = 128;

const EPISODE_CHART_LABEL_CLASSNAME =
	"mt-1.5 block h-5 text-center text-muted-foreground text-sm leading-5 tabular-nums";

/** Color key for the episode tiles. Pinned to the bottom of the dialog body. */
function EpisodeScoreLegend() {
	return (
		<ul
			aria-label="Score colors"
			className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 px-1 pt-1"
		>
			{EPISODE_SCORE_LEGEND.map((item) => (
				<li key={item.band} className="flex items-center gap-2 text-sm">
					<span
						aria-hidden
						className="size-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: item.backgroundColor }}
					/>
					{item.label}
				</li>
			))}
		</ul>
	);
}

/** Shared shape for a score tile. Color comes from the score band. */
const EPISODE_SCORE_TILE_CLASSNAME =
	"flex w-full cursor-pointer select-none items-center justify-center rounded-xl font-semibold text-lg tabular-nums";

/**
 * One season as a row of score tiles.
 * Tile height uses this season's score spread. The episode number sits under the tile.
 */
function EpisodeRatingChart({
	episodes,
	seasonNumber,
	logs,
	onOpenLog,
}: {
	episodes: TvEpisodeSummary[];
	seasonNumber: number;
	logs: readonly DiaryTvEpisodeLog[];
	onOpenLog: (latestLogId: string) => void;
}) {
	const columns = episodes.map((episode) => ({
		episode,
		pill: pillForEpisode(
			{ seasonNumber, episodeNumber: episode.episode_number },
			logs,
		),
	}));
	const ratedScores = columns.flatMap((column) =>
		column.pill.kind === "rated" ? [column.pill.averageDisplay] : [],
	);
	const plotPx = ratedScores.length === 0 ? 40 : EPISODE_CHART_PLOT_PX;

	return (
		<div className="scrollbar-none overflow-x-auto" data-lenis-prevent-wheel>
			<div className="flex w-max min-w-full items-end gap-2">
				{columns.map(({ episode, pill }) => (
					<EpisodeRatingColumn
						key={episode.id}
						episodeNumber={episode.episode_number}
						pill={pill}
						plotPx={plotPx}
						scores={ratedScores}
						onOpenLog={onOpenLog}
					/>
				))}
			</div>
		</div>
	);
}

function EpisodeRatingColumn({
	pill,
	episodeNumber,
	plotPx,
	scores,
	onOpenLog,
}: {
	pill: DiaryTvPill;
	episodeNumber: number;
	plotPx: number;
	scores: readonly number[];
	onOpenLog: (latestLogId: string) => void;
}) {
	if (pill.kind === "empty") {
		return (
			<div className="flex w-[4.5rem] shrink-0 flex-col items-center">
				<div className="w-full" style={{ height: plotPx }} />
				<span className={EPISODE_CHART_LABEL_CLASSNAME}>{episodeNumber}</span>
			</div>
		);
	}

	if (pill.kind === "neutral") {
		return (
			<div className="flex w-[4.5rem] shrink-0 flex-col items-center">
				<div className="flex w-full items-end" style={{ height: plotPx }}>
					<button
						type="button"
						aria-label={`Episode ${episodeNumber}, watched, no rating`}
						className={cn(
							EPISODE_SCORE_TILE_CLASSNAME,
							"h-16 bg-[#6e6e6e] text-white [@media(hover:hover)]:hover:brightness-110",
						)}
						onClick={() => onOpenLog(pill.latestLogId)}
					>
						—
					</button>
				</div>
				<span className={EPISODE_CHART_LABEL_CLASSNAME}>{episodeNumber}</span>
			</div>
		);
	}

	if (pill.kind === "rated") {
		const score = formatLogRatingDisplay(pill.averageDisplay);
		const height = episodeBarHeightPx(pill.averageDisplay, scores);
		const fill = episodeScoreBandFill(pill.averageDisplay);
		return (
			<div className="flex w-[4.5rem] shrink-0 flex-col items-center">
				<div className="flex w-full items-end" style={{ height: plotPx }}>
					<button
						type="button"
						aria-label={`Episode ${episodeNumber}, average ${score}`}
						className={cn(
							EPISODE_SCORE_TILE_CLASSNAME,
							"[@media(hover:hover)]:hover:brightness-110",
						)}
						style={{ height, ...fill }}
						onClick={() => onOpenLog(pill.latestLogId)}
					>
						{score}
					</button>
				</div>
				<span className={EPISODE_CHART_LABEL_CLASSNAME}>{episodeNumber}</span>
			</div>
		);
	}

	const _exhaustive: never = pill;
	return _exhaustive;
}

function SeasonPosterThumb({
	src,
	label,
	concealed,
	onSelect,
}: {
	src: string | null;
	label: string;
	/** Hidden while this art is the flyer, so the row does not keep a second copy. */
	concealed: boolean;
	onSelect: (thumb: HTMLButtonElement) => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			className="relative aspect-2/3 min-h-11 w-11 shrink-0 cursor-pointer select-none overflow-hidden rounded-lg bg-background"
			onClick={(event) => onSelect(event.currentTarget)}
		>
			{src ? (
				<Image
					src={src}
					alt=""
					fill
					sizes="44px"
					className={cn("object-cover", concealed ? "invisible" : undefined)}
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

/** One poster traveling between the large slot and a bottom thumb. Writes the box directly so the arc stays off the React render. */
function DiaryTvPosterFlight({
	flight,
	onDone,
}: {
	flight: DiaryTvPosterFlightLeg;
	onDone: () => void;
}) {
	const nodeRef = useRef<HTMLDivElement>(null);
	const onDoneRef = useRef(onDone);
	onDoneRef.current = onDone;

	useEffect(() => {
		const node = nodeRef.current;
		if (!node) return;
		const controls = animate(0, 1, {
			duration: POSTER_FLY_S,
			ease: CARD_MORPH_EASE,
			onUpdate: (t) => {
				const frame = posterFlyFrame(
					flight.from,
					flight.to,
					t,
					flight.radiusFrom,
					flight.radiusTo,
				);
				node.style.left = `${frame.left}px`;
				node.style.top = `${frame.top}px`;
				node.style.width = `${frame.width}px`;
				node.style.height = `${frame.height}px`;
				node.style.borderRadius = `${frame.radius}px`;
			},
			onComplete: () => onDoneRef.current(),
		});
		return () => controls.stop();
	}, [flight]);

	const start = posterFlyFrame(
		flight.from,
		flight.to,
		0,
		flight.radiusFrom,
		flight.radiusTo,
	);

	return (
		<div
			ref={nodeRef}
			aria-hidden
			className="pointer-events-none fixed z-[252] overflow-hidden"
			style={{
				left: start.left,
				top: start.top,
				width: start.width,
				height: start.height,
				borderRadius: start.radius,
			}}
		>
			<Image
				src={flight.src}
				alt=""
				fill
				sizes="176px"
				className="object-cover"
				unoptimized={isTmdbCdnUrl(flight.src)}
			/>
		</div>
	);
}

/**
 * Episode list height tween. Same `.t-resize` measurement as the pricing FAQ:
 * an explicit height so open and close both animate, and the first measure
 * skips the transition so a season that starts open does not grow in.
 */
function DiaryTvSeasonPanel({
	open,
	panelId,
	children,
}: {
	open: boolean;
	panelId: string;
	children: ReactNode;
}) {
	const innerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);
	const [hasMeasured, setHasMeasured] = useState(false);

	useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) return;

		const syncHeight = () => {
			const next = el.scrollHeight;
			// Ignore 0 while the panel is clipped shut — that would snap the next open.
			if (next > 0) setHeight(next);
			setHasMeasured(true);
		};

		syncHeight();
		const observer = new ResizeObserver(syncHeight);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			id={panelId}
			aria-hidden={!open}
			inert={!open}
			className={cn(
				"overflow-hidden",
				hasMeasured && "t-resize [--resize-ease:cubic-bezier(0.45,0,0.55,1)]",
			)}
			style={{ height: open ? height : 0 }}
		>
			<div ref={innerRef} className="pt-3">
				{children}
			</div>
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
	// The large poster. `"show"` is the diary series art; a number is that season.
	const [focusedPoster, setFocusedPoster] = useState<DiaryPosterKey>("show");
	// Bottom row, in place. The focused poster is not in this list — it sits in the large slot.
	const [posterRow, setPosterRow] = useState<DiaryPosterKey[]>([]);
	const [posterSwap, setPosterSwap] = useState<DiaryTvPosterSwap | null>(null);
	// Closed seasons stay as headers so a long episode list can be folded away.
	const [expandedSeasons, setExpandedSeasons] = useState<ReadonlySet<number>>(
		() => new Set(),
	);
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
	const posterSwapRef = useRef(posterSwap);
	posterSwapRef.current = posterSwap;
	const posterSwapTokenRef = useRef(0);
	const posterSwapDoneRef = useRef(0);
	const pendingPosterSwapRef = useRef<{
		key: DiaryPosterKey;
		thumb: HTMLButtonElement;
	} | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	// Stays mounted through the shrink home after `open` flips false.
	const [alive, setAlive] = useState(false);
	const [scrimOn, setScrimOn] = useState(false);
	// Backdrop blur under a fading opacity snaps on at the end in Chrome.
	const softwareGpu = useSoftwareGpuRendering();
	/** Null once the card is at rest in the centered layout. */
	const [morph, setMorph] = useState<DiaryTvCardMorph | null>(null);
	const morphRef = useRef<DiaryTvCardMorph | null>(null);
	morphRef.current = morph;
	// Start box for the morph mount. Later targets continue from the live box.
	const openFromRef = useRef<DiaryTvCardMorph | null>(null);
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

	// A new show, or a fresh open, starts on the diary series poster.
	const posterFocusIdentity = open ? tmdbId : null;
	const [posterFocusSeen, setPosterFocusSeen] = useState(posterFocusIdentity);
	if (posterFocusSeen !== posterFocusIdentity) {
		setPosterFocusSeen(posterFocusIdentity);
		setFocusedPoster("show");
		setPosterRow([]);
		setPosterSwap(null);
	}

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
		closeDurationMsRef.current = 0;
		onConcealPosterRef.current(false);
		setMorph(null);
		setScrimOn(false);
		setAlive(false);
		if (exitReportedRef.current) return;
		exitReportedRef.current = true;
		onExitCompleteRef.current();
	}, [clearCloseTimer]);

	const maybeFinishClose = useCallback(() => {
		if (!closingRef.current) return;
		// The duration-0 snap that holds the card still is not the close.
		if (closeDurationMsRef.current <= 0) return;
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

	// Hold the card where it is and fade. A missing cell must not shrink toward a stale rect.
	const beginFadeClose = useCallback(() => {
		const current = morphRef.current;
		const alreadyFading =
			closingRef.current && (current == null || current.cardOpacity === 0);
		sessionRef.current = "idle";
		closingRef.current = true;
		setScrimOn(false);
		const panelNode = panelRef.current;
		const liveCard = panelNode ? readCardBox(panelNode, 32) : current?.card;
		if (liveCard && (current == null || current.cardOpacity !== 0)) {
			const slotNode = slotRef.current;
			const poster =
				(panelNode ? readPosterInside(panelNode) : null) ??
				current?.poster ??
				(slotNode
					? posterBoxInsideCard(liveCard, readCardBox(slotNode, 20))
					: {
							left: 0,
							top: 0,
							width: liveCard.width,
							height: liveCard.height,
							radius: liveCard.radius,
						});
			const held: DiaryTvCardMorph = {
				card: liveCard,
				poster,
				contentOpacity: current?.contentOpacity ?? 1,
				cardOpacity: 1,
				duration: 0,
			};
			// A fresh mount fades from the card on screen. An in-flight card keeps going.
			if (!current) openFromRef.current = held;
			setMorph(morphFade(held));
		}
		if (!alreadyFading) armCloseTimer(CARD_CONTENT_FADE_S);
	}, [armCloseTimer]);

	useEffect(() => clearCloseTimer, [clearCloseTimer]);

	// The cell left after the shrink started. Fade the card that is already mounted.
	useLayoutEffect(() => {
		if (!mounted || open || !closingRef.current) return;
		const cellNode = cellRef.current;
		if (cellInGrid && cellCanReceivePoster(cellNode)) return;
		beginFadeClose();
	}, [beginFadeClose, cellInGrid, cellRef, mounted, open]);

	// Measure the resting card, then grow it out of the poster before paint.
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
			setScrimOn(true);

			const cellNode = cellRef.current;
			const panelNode = panelRef.current;
			const slotNode = slotRef.current;
			const canMorph =
				!reduceMotion &&
				cellCanReceivePoster(cellNode) &&
				panelNode != null &&
				slotNode != null &&
				panelNode.getBoundingClientRect().width > 0;

			if (!canMorph || !cellNode || !panelNode || !slotNode) {
				setMorph(null);
				onConcealPosterRef.current(false);
				return;
			}

			const cellBox = readCellPosterBox(cellNode);
			const panelBox = readCardBox(panelNode, 32);
			const poster = posterBoxInsideCard(panelBox, readCardBox(slotNode, 20));
			onConcealPosterRef.current(true);
			openFromRef.current = morphFromCell(cellBox);
			setMorph(morphToPanel(panelBox, poster, CARD_MORPH_S));
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

		const cellNode = cellRef.current;
		const panelNode = panelRef.current;
		const closeKind = diaryTvPosterCloseKind({
			reduceMotion,
			cellInGrid: cellInGridRef.current,
			cellConnected: cellCanReceivePoster(cellNode),
			hasOrigin: true,
			hasPose: panelNode != null,
		});
		if (closeKind === "fade" || !cellNode || !panelNode) {
			beginFadeClose();
			return;
		}

		sessionRef.current = "idle";
		closingRef.current = true;
		setScrimOn(false);
		const here = readCardBox(panelNode, 32);
		const cellBox = readCellPosterBox(cellNode);
		const slotNode = slotRef.current;
		const held: DiaryTvCardMorph = {
			card: here,
			poster:
				readPosterInside(panelNode) ??
				(slotNode
					? posterBoxInsideCard(here, readCardBox(slotNode, 20))
					: {
							left: 0,
							top: 0,
							width: here.width,
							height: here.height,
							radius: here.radius,
						}),
			contentOpacity: morphRef.current?.contentOpacity ?? 1,
			cardOpacity: 1,
			duration: 0,
		};
		// Resting cards mount the shrink from this box. An in-flight card continues.
		if (!morphRef.current) openFromRef.current = held;
		setMorph(morphHome(cellBox, CARD_MORPH_S));
		armCloseTimer(CARD_MORPH_S);
	}, [
		armCloseTimer,
		beginFadeClose,
		cellRef,
		clearCloseTimer,
		mounted,
		open,
		reduceMotion,
	]);

	// Episodes arrive after the first measure. Grow the card to fit them, then rest.
	useEffect(() => {
		if (!morph || closingRef.current || morph.contentOpacity < 1) return;
		const panel = panelRef.current;
		if (!panel) return;
		// Loading bones stretch with the card and would push the target to the cap.
		const catalogueReady =
			!seasonsLoading && (seasons.length > 0 || seasonsError);
		if (!catalogueReady) return;

		let restTimer = 0;
		const sync = () => {
			if (closingRef.current) return;
			const current = morphRef.current;
			if (!current || current.contentOpacity < 1) return;
			const needed = readNaturalCardHeight(panel);
			if (needed > current.card.height + 8) {
				const grow = needed - current.card.height;
				setMorph({
					...current,
					card: {
						...current.card,
						height: needed,
						top: current.card.top - grow / 2,
					},
				});
				return;
			}
			window.clearTimeout(restTimer);
			// The observer keeps resetting this until the height animation stops.
			restTimer = window.setTimeout(() => {
				if (closingRef.current) return;
				const latest = morphRef.current;
				if (!latest) return;
				const again = readNaturalCardHeight(panel);
				if (again > latest.card.height + 8) {
					sync();
					return;
				}
				setMorph(null);
			}, 80);
		};

		const observer = new ResizeObserver(sync);
		const list = panel.querySelector("[data-diary-card-list]");
		const aside = panel.querySelector("[data-diary-card-aside]");
		if (list instanceof HTMLElement) observer.observe(list);
		if (aside instanceof HTMLElement) observer.observe(aside);
		sync();
		return () => {
			observer.disconnect();
			window.clearTimeout(restTimer);
		};
	}, [episodesBySeason, morph, seasons, seasonsError, seasonsLoading]);

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
			setPosterRow([]);
			setFocusedPoster("show");
			setPosterSwap(null);
			setEpisodesBySeason({});
			setSeasonFailed({});
			openingSeasonAppliedRef.current = false;
			setActiveSeason(null);
			setExpandedSeasons(new Set());

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
			setPosterRow(usable.map((season) => season.season_number));
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
			setExpandedSeasons(
				nextActive == null ? new Set() : new Set([nextActive]),
			);

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

	const toggleSeasonOpen = useCallback((seasonNumber: number) => {
		setActiveSeason(seasonNumber);
		setExpandedSeasons((prev) => {
			const next = new Set(prev);
			if (next.has(seasonNumber)) next.delete(seasonNumber);
			else next.add(seasonNumber);
			return next;
		});
	}, []);

	const selectSeason = useCallback((seasonNumber: number) => {
		setActiveSeason(seasonNumber);
		// Focusing a poster opens that season and folds the others shut.
		setExpandedSeasons((prev) => {
			if (prev.size === 1 && prev.has(seasonNumber)) return prev;
			return new Set([seasonNumber]);
		});
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

	const beginPosterSwap = useCallback(
		(key: DiaryPosterKey, thumb: HTMLButtonElement) => {
			const currentSwap = posterSwapRef.current;
			if (currentSwap) {
				setFocusedPoster(currentSwap.nextFocused);
				setPosterRow(currentSwap.nextRow);
				setPosterSwap(null);
				pendingPosterSwapRef.current = { key, thumb };
				return;
			}
			if (key === focusedPoster) return;
			const index = posterRow.indexOf(key);
			const slot = slotRef.current;
			if (index < 0 || !slot) return;
			const nextArt = posterKeyArt(key, seasons, posterPath);
			const currentArt = posterKeyArt(focusedPoster, seasons, posterPath);
			const nextRow = posterRow.slice();
			nextRow[index] = focusedPoster;
			const from = thumb.getBoundingClientRect();
			const to = slot.getBoundingClientRect();
			if (
				!nextArt.src ||
				!currentArt.src ||
				reduceMotion ||
				from.width <= 0 ||
				to.width <= 0
			) {
				setFocusedPoster(key);
				setPosterRow(nextRow);
				return;
			}
			posterSwapDoneRef.current = 0;
			posterSwapTokenRef.current += 1;
			setPosterSwap({
				token: posterSwapTokenRef.current,
				nextFocused: key,
				nextRow,
				incoming: {
					src: nextArt.src,
					from,
					to,
					radiusFrom: THUMB_RADIUS_PX,
					radiusTo: SLOT_RADIUS_PX,
				},
				outgoing: {
					src: currentArt.src,
					from: to,
					to: from,
					radiusFrom: SLOT_RADIUS_PX,
					radiusTo: THUMB_RADIUS_PX,
				},
			});
		},
		[focusedPoster, posterPath, posterRow, reduceMotion, seasons],
	);

	useLayoutEffect(() => {
		const pending = pendingPosterSwapRef.current;
		if (!pending || posterSwapRef.current) return;
		pendingPosterSwapRef.current = null;
		beginPosterSwap(pending.key, pending.thumb);
	}, [beginPosterSwap]);

	const finishPosterSwap = useCallback((token: number) => {
		const current = posterSwapRef.current;
		if (!current || current.token !== token) return;
		posterSwapDoneRef.current += 1;
		if (posterSwapDoneRef.current < 2) return;
		setFocusedPoster(current.nextFocused);
		setPosterRow(current.nextRow);
		setPosterSwap(null);
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
	const focusedArt = posterKeyArt(focusedPoster, seasons, posterPath);
	const largePosterSrc = focusedArt.src;

	const portal = (
		<>
			<div className="pointer-events-none fixed inset-0 z-[250]">
				{softwareGpu ? null : (
					<motion.div
						aria-hidden
						className="absolute inset-0"
						initial={false}
						animate={{
							backdropFilter: scrimOn ? "blur(8px)" : "blur(0px)",
						}}
						transition={{ duration: 0.35, ease: CARD_MORPH_EASE }}
					/>
				)}
				{/* Scrim is a real button so click-to-close stays keyboard-reachable. */}
				<motion.button
					type="button"
					aria-label="Close"
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"pointer-events-auto backdrop-blur-none",
					)}
					initial={false}
					animate={{ opacity: scrimOn ? 1 : 0 }}
					transition={{ duration: 0.35, ease: CARD_MORPH_EASE }}
					onClick={close}
				/>
			</div>
			<DiaryTvCardFrame
				morph={morph}
				from={openFromRef.current}
				panelRef={panelRef}
				posterSrc={showPosterSrc}
				titleId={titleId}
			>
				{/* Dialog corner. The title row keeps clear of this control. */}
				<button
					type="button"
					aria-label="Close"
					className={cn(
						"absolute top-4 right-4 z-10 inline-flex min-h-11 min-w-11 cursor-pointer select-none items-center justify-center rounded-full bg-background text-muted-foreground",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					onClick={close}
				>
					<X className="size-4" aria-hidden />
				</button>
				<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6 sm:flex-row">
					<aside
						data-diary-card-aside
						className="flex w-full shrink-0 flex-col gap-3 sm:w-44"
					>
						<div
							ref={slotRef}
							data-diary-flight-slot
							className={cn(
								"relative aspect-2/3 w-full shrink-0 overflow-hidden rounded-[1.25rem]",
								// Transparent while the card's poster is still traveling into this slot.
								morph ? "bg-transparent" : "bg-background",
							)}
						>
							{/* Hidden while the two posters are trading places, so only the flyers are visible. */}
							{largePosterSrc ? (
								<Image
									src={largePosterSrc}
									alt=""
									fill
									sizes="(max-width:640px) 80vw, 176px"
									className={cn(
										"object-cover",
										morph || posterSwap ? "invisible" : undefined,
									)}
									unoptimized={isTmdbCdnUrl(largePosterSrc)}
									priority
								/>
							) : null}
						</div>
						<Link
							href={`/tv/${tmdbId}`}
							className="inline-flex min-h-11 w-full cursor-pointer select-none items-center justify-center rounded-full bg-foreground px-5 font-semibold text-background text-sm hover:opacity-90"
						>
							See full page
						</Link>
						{seriesLabel ? (
							<p className="text-pretty font-medium text-foreground text-sm">
								{seriesLabel}
							</p>
						) : null}
						<div className="flex shrink-0 flex-wrap gap-2">
							{posterRow.map((key) => {
								const art = posterKeyArt(key, seasons, posterPath);
								return (
									<SeasonPosterThumb
										key={key === "show" ? "show" : `season-${key}`}
										src={art.src}
										label={art.label}
										concealed={posterSwap?.nextFocused === key}
										onSelect={(thumb) => {
											if (typeof key === "number") selectSeason(key);
											beginPosterSwap(key, thumb);
										}}
									/>
								);
							})}
						</div>
					</aside>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
						<div
							data-diary-card-heading
							className="flex items-start justify-between gap-3 pr-14"
						>
							<h2
								id={titleId}
								className="min-w-0 text-balance font-semibold text-foreground text-lg tracking-tight"
							>
								{title}
							</h2>
						</div>
						<div
							ref={listRef}
							data-diary-card-list
							className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						>
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
											<div className="flex items-end gap-1.5">
												{(["a", "b", "c", "d", "e", "f"] as const).map(
													(pillSlot, index) => (
														<span
															key={`bone-${slot}-${pillSlot}`}
															className="w-[4.5rem] animate-pulse rounded-xl bg-card"
															style={{ height: 48 + index * 10 }}
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
								const episodeAverage = seasonEpisodeAverage(
									seasonNumber,
									episodeLogs,
								);
								const name = season.name || `Season ${seasonNumber}`;
								const openSeason = expandedSeasons.has(seasonNumber);
								const panelId = `${titleId}-season-${seasonNumber}`;
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
										<button
											type="button"
											aria-expanded={openSeason}
											aria-controls={panelId}
											className="flex w-full cursor-pointer select-none items-center gap-3 text-left"
											onClick={() => toggleSeasonOpen(seasonNumber)}
										>
											<span className="min-w-0 flex-1 text-pretty font-medium text-sm">
												{name}
											</span>
											{episodeAverage ? (
												<span className="shrink-0 font-semibold text-xl tabular-nums leading-none">
													<span className="sr-only">Average </span>
													{formatLogRatingDisplay(
														episodeAverage.averageDisplay,
													)}
												</span>
											) : score ? (
												<span className="shrink-0 text-right">
													<span className="block font-semibold text-xl tabular-nums leading-none">
														{score}
													</span>
													<span className="text-muted-foreground text-sm">
														Season
													</span>
												</span>
											) : null}
											<ChevronDown
												className={cn(
													"size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.45,0,0.55,1)] motion-reduce:transition-none",
													openSeason ? "rotate-180" : undefined,
												)}
												aria-hidden
											/>
										</button>
										<DiaryTvSeasonPanel open={openSeason} panelId={panelId}>
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
												<div className="flex items-end gap-1.5">
													{loadingPillKeys(
														seasonNumber,
														season.episode_count,
													).map((pillKey, index) => (
														<span
															key={pillKey}
															className="w-[4.5rem] shrink-0 animate-pulse rounded-xl bg-card"
															style={{ height: 56 + (index % 5) * 12 }}
														/>
													))}
												</div>
											) : (
												<EpisodeRatingChart
													episodes={episodes}
													seasonNumber={seasonNumber}
													logs={episodeLogs}
													onOpenLog={openLatestLog}
												/>
											)}
										</DiaryTvSeasonPanel>
									</section>
								);
							})}
						</div>
						{seasons.length > 0 ? <EpisodeScoreLegend /> : null}
					</div>
				</div>
			</DiaryTvCardFrame>
			{posterSwap ? (
				<>
					<DiaryTvPosterFlight
						key={`${posterSwap.token}-out`}
						flight={posterSwap.outgoing}
						onDone={() => finishPosterSwap(posterSwap.token)}
					/>
					<DiaryTvPosterFlight
						key={`${posterSwap.token}-in`}
						flight={posterSwap.incoming}
						onDone={() => finishPosterSwap(posterSwap.token)}
					/>
				</>
			) : null}
		</>
	);

	return createPortal(portal, document.body);
}
