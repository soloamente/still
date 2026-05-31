"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useRef } from "react";

import {
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

const CELL_PX = 11;
const ROW_GAP_PX = 3;
const LABEL_COL_PX = 16;
const MONTH_ROW_PX = 12;

/** Intensity steps — active days must read clearly on `bg-card`. */
function heatmapCellClass(level: number): string {
	switch (Number(level)) {
		case 4:
			return "bg-foreground";
		case 3:
			return "bg-foreground/80";
		case 2:
			return "bg-foreground/55";
		case 1:
			return "bg-foreground/35";
		default:
			return "bg-muted/50";
	}
}

function monthLabelForWeekStart(weekStart: unknown): string | null {
	const key = activityDateKeyFromUnknown(weekStart);
	if (!key) return null;
	const month = Number.parseInt(key.slice(5, 7), 10) - 1;
	const day = Number.parseInt(key.slice(8, 10), 10);
	if (day > 7) return null;
	return MONTH_LABELS[month] ?? null;
}

const cellStyle = {
	width: CELL_PX,
	height: CELL_PX,
	minWidth: CELL_PX,
	minHeight: CELL_PX,
} as const;

/**
 * GitHub-style diary heatmap — last 52 weeks of watch logs (ST.2).
 * Weekday labels stay fixed; only week columns scroll (recent weeks on the right).
 */
export function ProfileActivitySignature({
	handle,
	className,
}: {
	handle: string;
	className?: string;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { signature, loading } = useProfileActivitySignature(handle);

	useEffect(() => {
		if (loading || !signature) return;
		const el = scrollRef.current;
		if (!el) return;
		el.scrollLeft = el.scrollWidth - el.clientWidth;
	}, [loading, signature]);

	if (loading) {
		return (
			<div
				className={cn(
					"mx-auto mt-4 h-24 w-full max-w-md animate-pulse rounded-xl bg-muted/30",
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

	return (
		<section
			className={cn("mx-auto mt-4 w-full max-w-md", className)}
			aria-label="Diary activity over the last 52 weeks"
		>
			<div className="flex items-end justify-between gap-3">
				<p className="font-medium text-foreground text-xs tracking-wide">
					Activity
				</p>
				<p className="text-[10px] text-muted-foreground tabular-nums">
					{signature.totalDaysActive} active day
					{signature.totalDaysActive === 1 ? "" : "s"}
				</p>
			</div>

			{/* Labels pinned left; week columns scroll independently */}
			<div className="mt-2 flex min-w-0 items-start">
				<div
					className="z-10 shrink-0 bg-card pr-1"
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
						className="inline-flex min-w-0 flex-col"
						style={{ gap: ROW_GAP_PX }}
					>
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
										style={cellStyle}
									>
										{label ?? ""}
									</div>
								);
							})}
						</div>

						{Array.from({ length: rowCount }, (_, rowIndex) => (
							<div
								key={
									ACTIVITY_SIGNATURE_WEEKDAY_ROW_KEYS[rowIndex] ??
									`row-${rowIndex}`
								}
								className="flex"
								style={{ gap: ROW_GAP_PX }}
							>
								{weeks.map((week, weekIndex) => {
									const day = week.days[rowIndex];
									const level = Number(day?.level ?? 0);
									const tooltip = day
										? formatActivitySignatureTooltip(day.date, day.count)
										: undefined;
									return (
										<div
											key={`${week.weekStart}-${day?.date ?? `${weekIndex}-${rowIndex}`}`}
											title={tooltip}
											className={cn(
												"block shrink-0 rounded-[2px]",
												heatmapCellClass(level),
											)}
											style={cellStyle}
										/>
									);
								})}
							</div>
						))}
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
