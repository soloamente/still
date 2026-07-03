"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
	type ActivitySignaturePayload,
	type ActivitySignatureWeek,
	normalizeActivitySignaturePayload,
} from "@/lib/activity-signature";
import { mergeActivitySignatureWeeks } from "@/lib/activity-signature-merge-weeks";
import { api } from "@/lib/api";

/** First paint — matches legacy single-page heatmap width. */
const INITIAL_WEEKS = 52;
/** Each older page when scrolling left. */
const OLDER_WEEKS = 26;

export type ProfileActivitySignatureTotals = {
	totalDaysActive: number;
	totalLogs: number;
};

/**
 * Paginated diary heatmap — initial recent chunk, prepend older weeks on demand.
 */
export function useProfileActivitySignatureInfinite(handle: string) {
	const [weeks, setWeeks] = useState<ActivitySignatureWeek[]>([]);
	const [rangeStart, setRangeStart] = useState<string | null>(null);
	const [hasOlder, setHasOlder] = useState(false);
	const [loadingInitial, setLoadingInitial] = useState(true);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [totals, setTotals] = useState<ProfileActivitySignatureTotals>({
		totalDaysActive: 0,
		totalLogs: 0,
	});
	const loadingOlderRef = useRef(false);

	const normalizedHandle = handle.trim().toLowerCase();

	const fetchPage = useCallback(
		async (query: { weeks: number; before?: string }) => {
			const res = await api.api
				.profiles({ handle: normalizedHandle })
				["activity-signature"].get({
					query: {
						weeks: query.weeks,
						...(query.before ? { before: query.before } : {}),
					},
				});
			if (res.error || !res.data) return null;
			return normalizeActivitySignaturePayload(
				res.data as ActivitySignaturePayload,
			);
		},
		[normalizedHandle],
	);

	const loadInitial = useCallback(async () => {
		if (!normalizedHandle) {
			setWeeks([]);
			setRangeStart(null);
			setHasOlder(false);
			setTotals({ totalDaysActive: 0, totalLogs: 0 });
			setLoadingInitial(false);
			return;
		}

		setLoadingInitial(true);
		setError(null);
		setWeeks([]);
		setRangeStart(null);
		setHasOlder(false);
		setTotals({ totalDaysActive: 0, totalLogs: 0 });

		try {
			const page = await fetchPage({ weeks: INITIAL_WEEKS });
			if (!page) {
				return;
			}
			setWeeks(page.weeks);
			setRangeStart(page.rangeStart ?? null);
			setHasOlder(page.hasOlder === true);
			setTotals({
				totalDaysActive: page.totalDaysActive,
				totalLogs: page.totalLogs,
			});
		} catch {
			setError("Could not load diary rhythm");
		} finally {
			setLoadingInitial(false);
		}
	}, [normalizedHandle, fetchPage]);

	const loadOlder = useCallback(async (): Promise<boolean> => {
		if (!normalizedHandle || !rangeStart || !hasOlder) return false;
		if (loadingOlderRef.current) return false;

		loadingOlderRef.current = true;
		setLoadingOlder(true);

		try {
			const page = await fetchPage({ weeks: OLDER_WEEKS, before: rangeStart });
			if (!page) {
				setError("Could not load earlier weeks");
				return false;
			}

			setWeeks((current) => mergeActivitySignatureWeeks(page.weeks, current));
			setRangeStart(page.rangeStart ?? rangeStart);
			setHasOlder(page.hasOlder === true);
			setTotals((current) => ({
				totalDaysActive: current.totalDaysActive + page.totalDaysActive,
				totalLogs: current.totalLogs + page.totalLogs,
			}));
			return true;
		} catch {
			setError("Could not load earlier weeks");
			return false;
		} finally {
			loadingOlderRef.current = false;
			setLoadingOlder(false);
		}
	}, [normalizedHandle, rangeStart, hasOlder, fetchPage]);

	useEffect(() => {
		void loadInitial();
	}, [loadInitial]);

	return {
		weeks,
		rangeStart,
		hasOlder,
		loadingInitial,
		loadingOlder,
		error,
		totals,
		loadOlder,
		reload: loadInitial,
	};
}
