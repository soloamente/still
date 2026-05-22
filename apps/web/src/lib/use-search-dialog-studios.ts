"use client";

import { env } from "@still/env/web";
import { useEffect, useState } from "react";

import type { SearchDialogStudio } from "@/lib/search-dialog-studios";

/**
 * Loads curated studio logos for the empty search dialog (Movies browse column).
 */
export function useSearchDialogStudios(enabled: boolean) {
	const [studios, setStudios] = useState<SearchDialogStudio[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setStudios([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const ctrl = new AbortController();
		const url = new URL("/api/movies/studios", env.NEXT_PUBLIC_SERVER_URL);
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
				if (!ctrl.signal.aborted) setLoading(false);
			});
		return () => ctrl.abort();
	}, [enabled]);

	return { studios, loading };
}
