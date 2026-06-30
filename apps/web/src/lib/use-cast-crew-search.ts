"use client";

import { useEffect, useState } from "react";

import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";
import { fetchPeopleSearch } from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

/** Debounced TMDb person (cast & crew) typeahead for the catalog search dialog. */
export function useCastCrewSearch(
	query: string,
	enabled: boolean,
	debounceMs = 240,
) {
	const [results, setResults] = useState<CastCrewSearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [setupHint, setSetupHint] = useState<string | null>(null);

	useEffect(() => {
		const q = query.trim();
		if (!enabled || !q) {
			setResults([]);
			setSetupHint(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchPeopleSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setResults([]);
					setSetupHint(null);
					return;
				}
				const data = res.data as {
					results?: CastCrewSearchHit[];
				} | null;
				setSetupHint(tmdbSetupHint(data));
				setResults((data?.results ?? []) as CastCrewSearchHit[]);
			} catch {
				if (!ctrl.signal.aborted) {
					setResults([]);
					setSetupHint(null);
				}
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, debounceMs);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query, enabled, debounceMs]);

	return { results, loading, setupHint };
}
