"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
	ACTIVITY_SIGNATURE_LEVEL_CLASS,
	ACTIVITY_SIGNATURE_ROW_LABELS,
	ACTIVITY_SIGNATURE_WEEKDAY_ROW_KEYS,
	activityDateKeyFromUnknown,
	formatActivitySignatureTooltip,
} from "@/lib/activity-signature";
import { useProfileActivitySignature } from "@/lib/use-profile-activity-signature";

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

/**
 * GitHub-style diary heatmap — last 52 weeks of watch logs (ST.2).
 * Week columns scroll horizontally; weekday labels stay pinned on the left.
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
	const reduceMotion = useReducedMotion();
	const { signature, loading } = useProfileActivitySignature(handle);
	const [hover, setHover] = useState<HoverState | null>(null);
	const [portalReady, setPortalReady] = useState(false);

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
	}, []);

	useEffect(() => {
		setPortalReady(true);
	}, []);

	useEffect(() => {
		if (loading || !signature) return;
		const el = scrollRef.current;
		if (!el) return;
		el.scrollLeft = el.scrollWidth - el.clientWidth;
	}, [loading, signature]);

	useEffect(() => {
		const scrollEl = scrollRef.current;
		if (!scrollEl) return;

		const handleReposition = () => {
			if (hoveredCellRef.current) {
				syncHoverPosition(hoveredCellRef.current);
			}
		};

		scrollEl.addEventListener("scroll", handleReposition, { passive: true });
		window.addEventListener("scroll", handleReposition, { passive: true });
		window.addEventListener("resize", handleReposition, { passive: true });

		return () => {
			scrollEl.removeEventListener("scroll", handleReposition);
			window.removeEventListener("scroll", handleReposition);
			window.removeEventListener("resize", handleReposition);
		};
	}, [syncHoverPosition]);

	if (loading) {
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

	if (!signature || signature.totalLogs <= 0) return null;

	const { weeks } = signature;
	const rowCount = weeks[0]?.days.length || 7;

	const tooltipPortal =
		portalReady && hover
			? createPortal(
					<AnimatePresence>
						<motion.div
							key={hover.dateKey}
							initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.9 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={
								reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.9 }
							}
							transition={{ duration: 0.2 }}
							className="pointer-events-none fixed z-120 whitespace-nowrap rounded-md bg-zinc-900 px-3 py-1.5 text-white text-xs shadow-xl dark:bg-white dark:text-zinc-900"
							style={{
								left: hover.x,
								top: hover.y - TOOLTIP_OFFSET_PX,
								transform: "translateX(-50%)",
							}}
						>
							{hover.count <= 0 ? (
								<>
									<span className="font-bold">No</span>
									<span className="text-zinc-400 dark:text-zinc-500">
										{" "}
										logs on {formatActivitySignatureTooltipDate(hover.dateKey)}
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
					</AnimatePresence>,
					document.body,
				)
			: null;

	return (
		<section
			className={cn(
				"mx-auto w-full",
				variant === "embedded" ? "max-w-full" : "mt-4 max-w-md",
				className,
			)}
			aria-label="Diary activity over the last 52 weeks"
			onMouseLeave={clearHover}
		>
			{tooltipPortal}

			{variant === "standalone" ? (
				<div className="flex items-end justify-between gap-3">
					<p className="font-medium text-foreground text-xs tracking-wide">
						Activity
					</p>
					<p className="text-[10px] text-muted-foreground tabular-nums">
						{signature.totalDaysActive} active day
						{signature.totalDaysActive === 1 ? "" : "s"}
					</p>
				</div>
			) : (
				<p className="mb-2 text-center text-[10px] text-muted-foreground tabular-nums">
					{signature.totalDaysActive} active day
					{signature.totalDaysActive === 1 ? "" : "s"} · {signature.totalLogs}{" "}
					log{signature.totalLogs === 1 ? "" : "s"} in the last 52 weeks
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

				<div
					ref={scrollRef}
					className={cn(
						"min-w-0 flex-1 overflow-x-auto pb-1",
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

						{/* Week columns — matches GitHub calendar column layout */}
						<div
							className="relative flex w-max max-w-full flex-nowrap"
							style={{ gap: ROW_GAP_PX }}
						>
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
											<motion.div
												key={dateKey}
												initial={
													reduceMotion ? false : { opacity: 0, scale: 0 }
												}
												animate={{ opacity: 1, scale: 1 }}
												transition={
													reduceMotion
														? { duration: 0 }
														: {
																delay: weekIndex * 0.01 + dayIndex * 0.01,
																type: "spring",
																stiffness: 260,
																damping: 20,
															}
												}
												onMouseEnter={(event) => {
													if (!day?.date) return;
													const cell = event.currentTarget;
													const rect = cell.getBoundingClientRect();
													hoveredCellRef.current = cell;
													setHover({
														dateKey: day.date,
														count,
														x: rect.left + rect.width / 2,
														y: rect.top,
													});
												}}
												className={cn(
													"aspect-square w-full rounded-[2px] transition-colors duration-200",
													heatmapCellClass(level),
												)}
												role="img"
												aria-label={formatActivitySignatureTooltip(
													day?.date ?? dateKey,
													count,
												)}
											/>
										);
									})}
								</div>
							))}
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
