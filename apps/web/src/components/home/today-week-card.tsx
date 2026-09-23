"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { TodayWeekCardSkeletonBody } from "@/components/home/today-week-card-skeleton";
import { useCatalogSearchDialog } from "@/lib/catalog-search-dialog-store";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	TODAY_CARD_ACTION_CLASSNAME as CARD_ACTION_CLASSNAME,
	TODAY_CARD_HEADING_CLASSNAME,
	TODAY_SUPPORTING_CARD_CLASSNAME,
} from "@/lib/today-card-layout";
import {
	TODAY_WEEK_DAYS,
	TODAY_WEEK_REFRESH_EVENT,
	type TodayWeekPulse,
	todayWeekPulseHeadline,
	todayWeekPulseMarksLabel,
} from "@/lib/today-week-pulse";
import {
	fetchTodayWeekPulseClient,
	writeTodayTimeZoneCookie,
} from "@/lib/today-week-pulse-client";

type WeekCardState = {
	pulse: TodayWeekPulse | null;
	/** True only when there is nothing to show — a failed refresh keeps the last pulse. */
	failed: boolean;
};

/**
 * Today "Your week" — viewer's own diary pulse in the device timezone.
 * Seeded by the RSC (cookie timezone, else UTC); refetches when the device zone
 * differs or when `TODAY_WEEK_REFRESH_EVENT` fires after a log.
 */
export function TodayWeekCard({
	initial,
	initialTimeZone,
}: {
	initial: TodayWeekPulse | null;
	initialTimeZone: string;
}) {
	const headingId = useId();
	const requestSearch = useCatalogSearchDialog((s) => s.requestOpen);
	const [state, setState] = useState<WeekCardState>({
		pulse: initial,
		failed: false,
	});
	const abortRef = useRef<AbortController | null>(null);

	const refetch = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const next = await fetchTodayWeekPulseClient(
			readViewerTimeZone(),
			controller.signal,
		);
		if (controller.signal.aborted) return;
		setState((prev) =>
			next
				? { pulse: next, failed: false }
				: { pulse: prev.pulse, failed: prev.pulse == null },
		);
	}, []);

	useEffect(() => {
		const deviceTimeZone = readViewerTimeZone();
		const zoneMismatch = deviceTimeZone !== initialTimeZone;
		if (zoneMismatch) writeTodayTimeZoneCookie(deviceTimeZone);
		if (zoneMismatch || initial == null) void refetch();

		const handleRefresh = () => void refetch();
		window.addEventListener(TODAY_WEEK_REFRESH_EVENT, handleRefresh);
		return () => {
			window.removeEventListener(TODAY_WEEK_REFRESH_EVENT, handleRefresh);
			abortRef.current?.abort();
		};
	}, [initial, initialTimeZone, refetch]);

	const handleRetry = () => {
		setState({ pulse: null, failed: false });
		void refetch();
	};

	const { pulse, failed } = state;

	return (
		<section
			className={TODAY_SUPPORTING_CARD_CLASSNAME}
			aria-labelledby={headingId}
			aria-busy={pulse == null && !failed}
		>
			<h3 id={headingId} className={TODAY_CARD_HEADING_CLASSNAME}>
				Your week
			</h3>

			{pulse ? (
				<>
					<p className="text-balance font-semibold text-foreground text-lg leading-snug tracking-tight">
						{todayWeekPulseHeadline(pulse)}
					</p>
					<div
						role="img"
						aria-label={todayWeekPulseMarksLabel(pulse.dayMarks)}
						className="flex gap-3"
					>
						{TODAY_WEEK_DAYS.map((day, i) => (
							<span
								key={day.id}
								aria-hidden
								className="flex flex-col items-center gap-1.5"
							>
								<span className="text-[11px] text-muted-foreground tabular-nums">
									{day.short}
								</span>
								<span
									className={cn(
										"size-2.5 rounded-full",
										pulse.dayMarks[i]
											? "bg-foreground"
											: "bg-muted-foreground/25",
									)}
								/>
							</span>
						))}
					</div>
					{pulse.empty ? (
						<button
							type="button"
							className={CARD_ACTION_CLASSNAME}
							onClick={() => requestSearch()}
						>
							Log a title
						</button>
					) : (
						<Link href="/diary" className={CARD_ACTION_CLASSNAME}>
							Open diary
						</Link>
					)}
				</>
			) : failed ? (
				<>
					<p className="text-muted-foreground text-sm">
						Couldn’t load your week.
					</p>
					<button
						type="button"
						className={CARD_ACTION_CLASSNAME}
						onClick={handleRetry}
					>
						Try again
					</button>
				</>
			) : (
				<TodayWeekCardSkeletonBody />
			)}
		</section>
	);
}
