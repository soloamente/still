"use client";

import { useEffect, useState } from "react";

import type { SearchDialogStudio } from "@/lib/search-dialog-studios";
import { stillApiOrigin } from "@/lib/still-api-origin";

/**
 * Loads curated studio logos for the empty search dialog (Movies browse column).
 */
export function useSearchDialogStudios(enabled: boolean) {
	const [studios, setStudios] = useState<SearchDialogStudio[]>([]);
	const [loading, setLoading] = useState(false);
	/** True after the latest enabled fetch settles — avoids hydrating tags before studios arrive. */
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setStudios([]);
			setLoading(false);
			setLoaded(false);
			return;
		}
		setLoading(true);
		setLoaded(false);
		const ctrl = new AbortController();
		// Same origin as other browser `/api/*` calls so rewrites + session cookies apply.
		const url = new URL("/api/movies/studios", stillApiOrigin());
		void fetch(url, { credentials: "include", signal: ctrl.signal })
			.then(async (res) => {
				if (!res.ok) return [];
				const body = (await res.json()) as {
					studios?: { id: number; name: string; logo_url?: string | null }[];
				};
				return (body.studios ?? []).map((s) => ({
					id: s.id,
					name: s.name,
					logoUrl: s.logo_url ?? null,
				}));
			})
			.then((next) => {
				if (!ctrl.signal.aborted) setStudios(next);
			})
			.catch(() => {
				if (!ctrl.signal.aborted) setStudios([]);
			})
			.finally(() => {
				if (!ctrl.signal.aborted) {
					setLoading(false);
					setLoaded(true);
				}
			});
		return () => ctrl.abort();
	}, [enabled]);

	return { studios, loading, loaded };
}
