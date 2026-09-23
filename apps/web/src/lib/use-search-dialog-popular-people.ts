"use client";

import { useEffect, useState } from "react";

import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";
import {
	applySearchDialogPeopleRankMovements,
	readSearchDialogPeopleRankSnapshot,
	type SearchDialogPeopleRankMovement,
	writeSearchDialogPeopleRankSnapshot,
} from "@/lib/search-dialog-people-rank-delta";
import {
	pickSearchDialogPopularPeople,
	searchDialogPopularPeopleToRailItems,
	type SearchDialogPopularPeopleRailItem,
} from "@/lib/search-dialog-popular-people";
import { fetchPeoplePopular } from "@/lib/still-api-fetch";

export type SearchDialogPopularPeopleRailItemWithMovement =
	SearchDialogPopularPeopleRailItem & {
		rankMovement: SearchDialogPeopleRankMovement;
	};

/**
 * Empty catalog search people rail — TMDb popular people (not followed patrons),
 * with localStorage rank deltas for green↑ / red↓ overlays.
 */
export function useSearchDialogPopularPeople(enabled: boolean) {
	const [results, setResults] = useState<CastCrewSearchHit[]>([]);
	const [railItems, setRailItems] = useState<
		SearchDialogPopularPeopleRailItemWithMovement[]
	>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setResults([]);
			setRailItems([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		void (async () => {
			try {
				const res = await fetchPeoplePopular({ signal: ctrl.signal });
				if (ctrl.signal.aborted) return;
				if (res.error) {
					setResults([]);
					setRailItems([]);
					return;
				}
				const data = res.data as { results?: CastCrewSearchHit[] } | null;
				const picked = pickSearchDialogPopularPeople(data?.results ?? []);
				setResults(picked);

				const base = searchDialogPopularPeopleToRailItems(picked);
				const previous = readSearchDialogPeopleRankSnapshot();
				const { items, nextSnapshot } = applySearchDialogPeopleRankMovements(
					base,
					previous,
				);
				setRailItems(items);
				writeSearchDialogPeopleRankSnapshot(nextSnapshot);
			} catch {
				if (!ctrl.signal.aborted) {
					setResults([]);
					setRailItems([]);
				}
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		})();
		return () => ctrl.abort();
	}, [enabled]);

	return { results, railItems, loading };
}
