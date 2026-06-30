"use client";

import { useEffect, useState } from "react";

import { type ListBoardRow, toListBoardRow } from "@/lib/list-board-row";
import { fetchListsSearch } from "@/lib/still-api-fetch";

/** Debounced plain-text search over the patron's lists for the catalog dialog. */
export function useListsTextSearch(
	query: string,
	enabled: boolean,
	debounceMs = 240,
) {
	const [results, setResults] = useState<ListBoardRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [needsSignIn, setNeedsSignIn] = useState(false);

	useEffect(() => {
		const q = query.trim();
		if (!enabled || !q) {
			setResults([]);
			setNeedsSignIn(false);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchListsSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.response.status === 401) {
					setResults([]);
					setNeedsSignIn(true);
					return;
				}
				setNeedsSignIn(false);
				if (res.error) {
					setResults([]);
					return;
				}
				const rows = Array.isArray(res.data)
					? res.data.map((row) => toListBoardRow(row))
					: [];
				setResults(rows);
			} catch {
				if (!ctrl.signal.aborted) setResults([]);
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, debounceMs);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query, enabled, debounceMs]);

	return { results, loading, needsSignIn };
}
