"use client";

import { useEffect, useState } from "react";
import type { ProfileSearchHit } from "@/lib/profile-search-query";
import { normalizeProfileSearchQuery } from "@/lib/profile-search-query";
import { fetchProfileSearch } from "@/lib/still-api-fetch";

/**
 * Debounced patron profile typeahead for the catalog search dialog.
 */
export function useProfileSearch(query: string, enabled: boolean) {
	const [hits, setHits] = useState<ProfileSearchHit[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const normalized = normalizeProfileSearchQuery(query);
		if (!enabled || normalized.length < 1) {
			setHits([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchProfileSearch(normalized, {
					signal: ctrl.signal,
				});
				if (ctrl.signal.aborted) return;
				const list = Array.isArray(res.data) ? res.data : [];
				setHits(list as ProfileSearchHit[]);
			} catch {
				if (!ctrl.signal.aborted) setHits([]);
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, 220);

		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query, enabled]);

	return { hits, loading };
}
