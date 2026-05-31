"use client";

import { useCallback, useEffect, useState } from "react";

import {
	type ActivitySignaturePayload,
	normalizeActivitySignaturePayload,
} from "@/lib/activity-signature";
import { api } from "@/lib/api";

/**
 * Loads the patron diary heatmap for profile display (ST.2).
 * Client fetch avoids RSC prop serialization dropping nested week/day cells.
 */
export function useProfileActivitySignature(handle: string) {
	const [signature, setSignature] = useState<ActivitySignaturePayload | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		if (!handle.trim()) {
			setSignature(null);
			setLoading(false);
			return;
		}
		try {
			const res = await api.api
				.profiles({ handle: handle.toLowerCase() })
				["activity-signature"].get();
			if (res.error || !res.data) {
				setSignature(null);
				return;
			}
			setSignature(
				normalizeActivitySignaturePayload(res.data as ActivitySignaturePayload),
			);
		} catch {
			setSignature(null);
		} finally {
			setLoading(false);
		}
	}, [handle]);

	useEffect(() => {
		void load();
	}, [load]);

	return { signature, loading };
}
