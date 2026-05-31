"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { CreatorAnalyticsPayload } from "@/lib/creator-analytics-types";

/**
 * Loads curator analytics for the signed-in patron (SN.13). Returns null when not a curator.
 */
export function useCreatorAnalytics() {
	const [analytics, setAnalytics] = useState<CreatorAnalyticsPayload | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			const res = await api.api.profiles.me["creator-analytics"].get();
			if (res.error || !res.data) {
				setAnalytics(null);
				return;
			}
			const data = res.data as {
				eligible?: boolean;
				analytics?: CreatorAnalyticsPayload;
			};
			setAnalytics(data.eligible && data.analytics ? data.analytics : null);
		} catch {
			setAnalytics(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	return { analytics, loading };
}
