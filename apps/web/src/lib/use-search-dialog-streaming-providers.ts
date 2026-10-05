"use client";

import { useEffect, useState } from "react";

import type { SearchDialogStreamingProvider } from "@/lib/search-dialog-streaming-providers";
import { stillApiOrigin } from "@/lib/still-api-origin";

/** Flatrate platforms in the patron Settings watch region (search dialog rail + autocomplete). */
export function useSearchDialogStreamingProviders(enabled: boolean) {
	const [providers, setProviders] = useState<SearchDialogStreamingProvider[]>(
		[],
	);
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [needsRegion, setNeedsRegion] = useState(false);
	const [region, setRegion] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled) {
			setProviders([]);
			setLoading(false);
			setLoaded(false);
			setNeedsRegion(false);
			setRegion(null);
			return;
		}
		setLoading(true);
		setLoaded(false);
		const ctrl = new AbortController();
		const url = new URL("/api/movies/streaming-providers", stillApiOrigin());
		void fetch(url, { credentials: "include", signal: ctrl.signal })
			.then(async (res) => {
				if (!res.ok) return null;
				return (await res.json()) as {
					providers?: {
						id: number;
						name: string;
						logo_url?: string | null;
					}[];
					region?: string | null;
					needs_region?: boolean;
				};
			})
			.then((body) => {
				if (ctrl.signal.aborted || !body) return;
				setNeedsRegion(Boolean(body.needs_region));
				setRegion(body.region ?? null);
				setProviders(
					(body.providers ?? []).map((p) => ({
						id: p.id,
						name: p.name,
						logoUrl: p.logo_url ?? null,
					})),
				);
			})
			.catch(() => {
				if (!ctrl.signal.aborted) {
					setProviders([]);
					setNeedsRegion(false);
					setRegion(null);
				}
			})
			.finally(() => {
				if (!ctrl.signal.aborted) {
					setLoading(false);
					setLoaded(true);
				}
			});
		return () => ctrl.abort();
	}, [enabled]);

	return { providers, loading, loaded, needsRegion, region };
}
