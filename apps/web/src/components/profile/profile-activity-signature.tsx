"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	type MouseEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

import {
	ACTIVITY_SIGNATURE_LEVEL_CLASS,
	ACTIVITY_SIGNATURE_ROW_LABELS,
	ACTIVITY_SIGNATURE_WEEKDAY_ROW_KEYS,
	activityDateKeyFromUnknown,
	formatActivitySignatureTooltip,
	resolveActivitySignatureTooltipPlacement,
} from "@/lib/activity-signature";
import { computeScrollLeftAfterPrepend } from "@/lib/activity-signature-prepend-scroll";
import { useHorizontalScrollFades } from "@/lib/use-horizontal-scroll-fades";
import { useProfileActivitySignatureInfinite } from "@/lib/use-profile-activity-signature-infinite";

const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

const CELL_PX = 12;
const ROW_GAP_PX = 3;
const LABEL_COL_PX = 16;
const MONTH_ROW_PX = 14;
const TOOLTIP_OFFSET_PX = 40;
/** Load older weeks when the scrollport is within this distance of the left edge. */
const LOAD_OLDER_SCROLL_THRESHOLD_PX = 80;
const OLDER_SKELETON_COLUMN_KEYS = ["a", "b", "c"] as const;

/** Resolve heatmap fill for a quartile level (0–4). */
function heatmapCellClass(level: number): string {
	return (
		ACTIVITY_SIGNATURE_LEVEL_CLASS[Number(level)] ??
		ACTIVITY_SIGNATURE_LEVEL_CLASS[0]
	);
}

function monthLabelForWeekStart(weekStart: unknown): string | null {
	const key = activityDateKeyFromUnknown(weekStart);
	if (!key) return null;
	const month = Number.parseInt(key.slice(5, 7), 10) - 1;
	const day = Number.parseInt(key.slice(8, 10), 10);
	if (day > 7) return null;
	return MONTH_LABELS[month] ?? null;
}

function formatActivitySignatureTooltipDate(dateKey: string): string {
	return new Date(`${dateKey}T12:00:00.000Z`).toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

const weekColumnStyle = {
	width: CELL_PX,
	minWidth: CELL_PX,
} as const;

type HoverState = {
	dateKey: string;
	count: number;
	/** Viewport X — cell center, for fixed tooltip placement. */
	x: number;
	/** Viewport Y — cell top edge. */
	y: number;
};

type HeatmapCellProps = {
	dateKey: string;
	count: number;
	level: number;
	weekIndex: number;
	dayIndex: number;
	animateEntry: boolean;
	reduceMotion: boolean | null;
	onHover: (cell: HTMLElement, date: string, logCount: number) => void;
};

/** Single diary day cell — spring enter only on the initial recent chunk. */
function HeatmapCell({
	dateKey,
	count,
	level,
	weekIndex,
	dayIndex,
	animateEntry,
	reduceMotion,
	onHover,
}: HeatmapCellProps) {
	const className = cn(
		"aspect-square w-full rounded-[2px] transition-colors duration-200",
		heatmapCellClass(level),
	);

	const handleMouseEnter = (event: MouseEvent<HTMLElement>) => {
		onHover(event.currentTarget, dateKey, count);
	};

	if (animateEntry && !reduceMotion) {
		return (
			<motion.div
				initial={{ opacity: 0, scale: 0 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{
					delay: weekIndex * 0.01 + dayIndex * 0.01,
					type: "spring",
					stiffness: 260,
					damping: 20,
				}}
				onMouseEnter={handleMouseEnter}
				className={className}
				role="img"
				aria-label={formatActivitySignatureTooltip(dateKey, count)}
			/>
		);
	}

	return (
		<div
			onMouseEnter={handleMouseEnter}
			className={className}
			role="img"
			aria-label={formatActivitySignatureTooltip(dateKey, count)}
		/>
	);
}

/**
 * GitHub-style diary heatmap — paginated week columns with horizontal scroll.
 * Opens anchored on recent weeks; older history prepends when scrolling left.
 */
export function ProfileActivitySignature({
	handle,
	className,
	variant = "standalone",
}: {
	handle: string;
	className?: string;
	/** In profile About — no extra chrome; parent supplies the section title. */
	variant?: "standalone" | "embedded";
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const hoveredCellRef = useRef<HTMLElement | null>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const didInitialScrollRef = useRef(false);
	const initialAnimateWeekStartsRef = useRef<Set<string> | null>(null);
	const reduceMotion = useReducedMotion();

	const {
		weeks,
		hasOlder,
		loadingInitial,
		loadingOlder,
		error,
		totals,
		loadOlder,
	} = useProfileActivitySignatureInfinite(handle);

	const [hover, setHover] = useState<HoverState | null>(null);
	const [tooltipPlacement, setTooltipPlacement] = useState<{
		left: number;
		top: number;
	} | null>(null);
	const [portalReady, setPortalReady] = useState(false);

	const scrollFadeSurface = variant === "embedded" ? "background" : "card";
	const scrollContentKey = `${weeks.length}:${loadingOlder ? "older" : "idle"}`;
	const { showStartFade, showEndFade, syncScrollFades } =
		useHorizontalScrollFades(scrollRef, weeks.length > 0, scrollContentKey);

	const syncHoverPosition = useCallback((cell: HTMLElement) => {
		const rect = cell.getBoundingClientRect();
		setHover((current) => {
			if (!current) return current;
			return {
				...current,
				x: rect.left + rect.width / 2,
				y: rect.top,
			};
		});
	}, []);

	const clearHover = useCallback(() => {
		hoveredCellRef.current = null;
		setHover(null);
		setTooltipPlacement(null);
	}, []);

	const handleCellHover = useCallback(
		(cell: HTMLElement, dateKey: string, count: number) => {
			const rect = cell.getBoundingClientRect();
			hoveredCellRef.current = cell;
			setHover({
				dateKey,
				count,
				x: rect.left + rect.width / 2,
				y: rect.top,
			});
		},
		[],
	);

	const handleLoadOlder = useCallback(async () => {
		const el = scrollRef.current;
		if (!el) return;
		const prevScrollWidth = el.scrollWidth;
		const loaded = await loadOlder();
		if (!loaded) return;

		requestAnimationFrame(() => {
			const scrollEl = scrollRef.current;
			if (!scrollEl) return;
			scrollEl.scrollLeft = computeScrollLeftAfterPrepend({
				scrollLeft: scrollEl.scrollLeft,
				prevScrollWidth,
				nextScrollWidth: scrollEl.scrollWidth,
			});
			syncScrollFades();
		});
	}, [loadOlder, syncScrollFades]);

	// Measure the portal tooltip and clamp it inside the viewport (right-edge cells).
	useLayoutEffect(() => {
		if (!hover || !tooltipRef.current) {
			setTooltipPlacement(null);
			return;
		}

		const { width, height } = tooltipRef.current.getBoundingClientRect();
		setTooltipPlacement(
			resolveActivitySignatureTooltipPlacement({
				anchorX: hover.x,
				anchorY: hover.y,
				tooltipWidth: width,
				tooltipHeight: height,
				offsetAbovePx: TOOLTIP_OFFSET_PX,
				cellHeightPx: CELL_PX,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight,
			}),
		);
	}, [hover]);

	useEffect(() => {
		setPortalReady(true);
	}, []);

	// Remember which week columns played the first-load stagger animation.
	useEffect(() => {
		if (loadingInitial || weeks.length === 0) return;
		if (initialAnimateWeekStartsRef.current) return;
		initialAnimateWeekStartsRef.current = new Set(
			weeks.map((week) => week.weekStart),
		);
	}, [loadingInitial, weeks]);

	// Anchor the scrollport on the most recent weeks once per mount / handle load.
	useEffect(() => {
		if (loadingInitial || weeks.length === 0 || didInitialScrollRef.current) {
			return;
		}
		const el = scrollRef.current;
		if (!el) return;
		el.scrollLeft = el.scrollWidth - el.clientWidth;
		didInitialScrollRef.current = true;
		syncScrollFades();
	}, [loadingInitial, weeks.length, syncScrollFades]);

	// Reset initial scroll + animation tracking when the patron changes.
	useEffect(() => {
		didInitialScrollRef.current = false;
		initialAnimateWeekStartsRef.current = null;
	}, [handle]);

	useEffect(() => {
		const scrollEl = scrollRef.current;
		if (!scrollEl || loadingInitial) return;

		const handleReposition = () => {
			if (hoveredCellRef.current) {
				syncHoverPosition(hoveredCellRef.current);
			}
		};

		const handleScroll = () => {
			handleReposition();
			if (
				scrollEl.scrollLeft < LOAD_OLDER_SCROLL_THRESHOLD_PX &&
				hasOlder &&
				!loadingOlder
			) {
				void handleLoadOlder();
			}
		};

		scrollEl.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("scroll", handleReposition, { passive: true });
		window.addEventListener("resize", handleReposition, { passive: true });

		return () => {
			scrollEl.removeEventListener("scroll", handleScroll);
			window.removeEventListener("scroll", handleReposition);
			window.removeEventListener("resize", handleReposition);
		};
	}, [
		loadingInitial,
		hasOlder,
		loadingOlder,
		handleLoadOlder,
		syncHoverPosition,
	]);

	if (loadingInitial) {
		return (
			<div
				className={cn(
					"mx-auto h-32 w-full animate-pulse rounded-xl bg-muted/30",
					variant === "embedded" ? "max-w-full" : "mt-4 max-w-md",
					className,
				)}
				role="status"
				aria-label="Loading activity heatmap"
			/>
		);
	}

	if (error && weeks.length === 0) {
		return (
			<p
				className={cn(
					"text-center text-muted-foreground text-xs",
					variant === "embedded" ? "max-w-full" : "mt-4 max-w-md",
					className,
				)}
			>
				{error}
			</p>
		);
	}

	if (weeks.length === 0 || totals.totalLogs <= 0) return null;

	const rowCount = weeks[0]?.days.length || 7;
	const animateWeekStarts = initialAnimateWeekStartsRef.current;

	const tooltipPortal =
		portalReady && hover
			? createPortal(
					<AnimatePresence>
						<div
							key={hover.dateKey}
							ref={tooltipRef}
							className="pointer-events-none fixed z-120"
							style={{
								left: tooltipPlacement?.left ?? 0,
								top: tooltipPlacement?.top ?? 0,
								visibility: tooltipPlacement ? "visible" : "hidden",
							}}
						>
							<motion.div
								initial={
									reduceMotion ? false : { opacity: 0, y: 10, scale: 0.9 }
								}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={
									reduceMotion
										? { opacity: 0 }
										: { opacity: 0, y: 5, scale: 0.9 }
								}
								transition={{ duration: 0.2 }}
								className="max-w-[calc(100vw-1.5rem)] whitespace-nowrap rounded-md bg-zinc-900 px-3 py-1.5 text-white text-xs shadow-xl dark:bg-white dark:text-zinc-900"
							>
								{hover.count <= 0 ? (
									<>
										<span className="font-bold">No</span>
										<span className="text-zinc-400 dark:text-zinc-500">
											{" "}
											logs on{" "}
											{formatActivitySignatureTooltipDate(hover.dateKey)}
										</span>
									</>
								) : (
									<>
										<span className="mr-1 font-bold">{hover.count}</span>
										<span className="text-zinc-400 dark:text-zinc-500">
											{hover.count === 1 ? "log" : "logs"} on{" "}
											{formatActivitySignatureTooltipDate(hover.dateKey)}
										</span>
									</>
								)}
							</motion.div>
						</div>
					</AnimatePresence>,
					document.body,
				)
			: null;

	const olderSkeletonColumns = loadingOlder
		? OLDER_SKELETON_COLUMN_KEYS.map((columnKey) => (
				<div
					key={`older-skeleton-${columnKey}`}
					className="flex shrink-0 flex-col"
					style={{ ...weekColumnStyle, gap: ROW_GAP_PX }}
					aria-hidden
				>
					{ACTIVITY_SIGNATURE_WEEKDAY_ROW_KEYS.map((rowKey) => (
						<div
							key={`older-skeleton-cell-${columnKey}-${rowKey}`}
							className="aspect-square w-full animate-pulse rounded-[2px] bg-muted/40"
						/>
					))}
				</div>
			))
		: null;

	const olderSkeletonMonthCells = loadingOlder
		? OLDER_SKELETON_COLUMN_KEYS.map((columnKey) => (
				<div
					key={`older-skeleton-month-${columnKey}`}
					className="shrink-0"
					style={weekColumnStyle}
					aria-hidden
				/>
			))
		: null;

	return (
		<section
			className={cn(
				"mx-auto w-full",
				variant === "embedded" ? "max-w-full" : "mt-4 max-w-md",
				className,
			)}
			aria-label="Diary activity — scroll horizontally for earlier weeks"
			onMouseLeave={clearHover}
		>
			{tooltipPortal}

			{variant === "standalone" ? (
				<div className="flex items-end justify-between gap-3">
					<p className="font-medium text-foreground text-xs tracking-wide">
						Activity
					</p>
					<p className="text-[10px] text-muted-foreground tabular-nums">
						{totals.totalDaysActive} active day
						{totals.totalDaysActive === 1 ? "" : "s"}
						{hasOlder ? " · scroll for earlier" : ""}
					</p>
				</div>
			) : (
				<p className="mb-2 text-center text-[10px] text-muted-foreground tabular-nums">
					{totals.totalDaysActive} active day
					{totals.totalDaysActive === 1 ? "" : "s"} · {totals.totalLogs} log
					{totals.totalLogs === 1 ? "" : "s"} loaded
					{hasOlder ? " · scroll for earlier" : ""}
				</p>
			)}

			<div
				className={cn(
					"flex min-w-0 items-start",
					variant === "standalone" ? "mt-2" : "mt-0",
				)}
			>
				{/* Weekday labels pinned left while week columns scroll */}
				<div
					className="z-10 shrink-0 bg-transparent pr-1"
					style={{ width: LABEL_COL_PX }}
					aria-hidden
				>
					<div style={{ height: MONTH_ROW_PX, marginBottom: ROW_GAP_PX }} />
					<div className="flex flex-col" style={{ gap: ROW_GAP_PX }}>
						{Array.from({ length: rowCount }, (_, rowIndex) => (
							<div
								key={
									ACTIVITY_SIGNATURE_WEEKDAY_ROW_KEYS[rowIndex] ??
									`label-${rowIndex}`
								}
								className={cn(
									"flex items-center text-[10px] text-muted-foreground tabular-nums leading-none",
									rowIndex % 2 === 0 ? "opacity-100" : "opacity-50",
								)}
								style={{ height: CELL_PX }}
							>
								{ACTIVITY_SIGNATURE_ROW_LABELS[rowIndex] ?? ""}
							</div>
						))}
					</div>
				</div>

				<div className="relative min-w-0 flex-1">
					<div
						aria-hidden
						className={cn(
							"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r to-transparent transition-opacity duration-200 motion-reduce:transition-none",
							scrollFadeSurface === "background"
								? "from-background via-background/80"
								: "from-card via-card/80",
							showStartFade ? "opacity-100" : "opacity-0",
						)}
					/>
					<div
						aria-hidden
						className={cn(
							"pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l to-transparent transition-opacity duration-200 motion-reduce:transition-none",
							scrollFadeSurface === "background"
								? "from-background via-background/85"
								: "from-card via-card/85",
							showEndFade ? "opacity-100" : "opacity-0",
						)}
					/>

					<div
						ref={scrollRef}
						data-lenis-prevent-wheel
						className={cn(
							"min-w-0 overflow-x-auto pb-1",
							"scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
						)}
					>
						<div
							className="inline-flex w-max min-w-0 max-w-full flex-col"
							style={{ gap: ROW_GAP_PX }}
						>
							{/* Month labels aligned to week columns */}
							<div
								className="flex"
								style={{ gap: ROW_GAP_PX, height: MONTH_ROW_PX }}
							>
								{olderSkeletonMonthCells}
								{weeks.map((week) => {
									const label = monthLabelForWeekStart(week.weekStart);
									return (
										<div
											key={`month-${week.weekStart}`}
											className="flex shrink-0 items-end justify-center overflow-visible text-[9px] text-muted-foreground leading-none"
											style={weekColumnStyle}
										>
											{label ?? ""}
										</div>
									);
								})}
							</div>

							{/* Week columns — GitHub calendar layout */}
							<div
								className="relative flex w-max max-w-full flex-nowrap"
								style={{ gap: ROW_GAP_PX }}
							>
								{olderSkeletonColumns}
								{weeks.map((week, weekIndex) => (
									<div
										key={week.weekStart}
										className="flex shrink-0 flex-col"
										style={{ ...weekColumnStyle, gap: ROW_GAP_PX }}
									>
										{week.days.map((day, dayIndex) => {
											const level = Number(day?.level ?? 0);
											const count = Number(day?.count ?? 0);
											const dateKey =
												day?.date ?? `${week.weekStart}-${dayIndex}`;

											return (
												<HeatmapCell
													key={dateKey}
													dateKey={day?.date ?? dateKey}
													count={count}
													level={level}
													weekIndex={weekIndex}
													dayIndex={dayIndex}
													animateEntry={
														animateWeekStarts?.has(week.weekStart) ?? false
													}
													reduceMotion={reduceMotion}
													onHover={handleCellHover}
												/>
											);
										})}
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-2 flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground">
				<span>Less</span>
				{[0, 1, 2, 3, 4].map((level) => (
					<div
						key={level}
						className={cn(
							"block size-[9px] shrink-0 rounded-[2px]",
							heatmapCellClass(level),
						)}
						aria-hidden
					/>
				))}
				<span>More</span>
			</div>
		</section>
	);
}
