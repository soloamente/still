"use client";

import { useEffect, useMemo, useState } from "react";

import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";
import { castCrewMetaLine } from "@/lib/cast-crew-search-query";
import {
	extractMovieMentionCredits,
	filterMentionCreditsByQuery,
	type MentionCreditRow,
} from "@/lib/movie-mention-credits";
import { fetchPeopleSearch } from "@/lib/still-api-fetch";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type PeopleMentionHit =
	| { source: "credit"; row: MentionCreditRow }
	| { source: "search"; row: CastCrewSearchHit };

export { castCrewMetaLine };

/** Title cast/crew rail first, then global TMDb people search as the query grows. */
export function usePeopleMentionSearch(input: {
	query: string;
	listingContext: { kind: "movie" | "tv"; tmdbId: number } | null;
	enabled: boolean;
}) {
	const [creditRows, setCreditRows] = useState<MentionCreditRow[]>([]);
	const [searchRows, setSearchRows] = useState<CastCrewSearchHit[]>([]);
	const [loadingSearch, setLoadingSearch] = useState(false);

	// Load this title's cast/crew once when composing on a movie review.
	useEffect(() => {
		const movieContext =
			input.listingContext?.kind === "movie" ? input.listingContext : null;
		if (!input.enabled || !movieContext) {
			setCreditRows([]);
			return;
		}
		const ctrl = new AbortController();
		void (async () => {
			try {
				const res = await fetch(
					`${stillApiOrigin()}/api/movies/${movieContext.tmdbId}`,
					{ credentials: "include", signal: ctrl.signal },
				);
				if (!res.ok) return;
				const data = (await res.json()) as { tmdbJson?: unknown };
				setCreditRows(
					extractMovieMentionCredits(
						data.tmdbJson as Parameters<typeof extractMovieMentionCredits>[0],
					),
				);
			} catch {
				if (!ctrl.signal.aborted) setCreditRows([]);
			}
		})();
		return () => ctrl.abort();
	}, [input.enabled, input.listingContext?.kind, input.listingContext?.tmdbId]);

	useEffect(() => {
		if (!input.enabled) {
			setSearchRows([]);
			setLoadingSearch(false);
			return;
		}
		const q = input.query.trim();
		if (q.length < 2) {
			setSearchRows([]);
			setLoadingSearch(false);
			return;
		}

		setLoadingSearch(true);
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetchPeopleSearch(q, { signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				const rows =
					(res.data as { results?: CastCrewSearchHit[] } | null)?.results ?? [];
				setSearchRows(rows.slice(0, 8));
			} catch {
				if (!ctrl.signal.aborted) setSearchRows([]);
			} finally {
				if (!ctrl.signal.aborted) setLoadingSearch(false);
			}
		}, 220);

		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [input.query, input.enabled]);

	const results = useMemo((): PeopleMentionHit[] => {
		const contextual = filterMentionCreditsByQuery(creditRows, input.query);
		const seen = new Set(contextual.map((row) => row.id));
		const merged: PeopleMentionHit[] = contextual.map((row) => ({
			source: "credit",
			row,
		}));
		for (const row of searchRows) {
			if (seen.has(row.id)) continue;
			seen.add(row.id);
			merged.push({ source: "search", row });
		}
		return merged.slice(0, 12);
	}, [creditRows, input.query, searchRows]);

	return {
		results,
		loading: loadingSearch && input.query.trim().length >= 2,
	};
}
