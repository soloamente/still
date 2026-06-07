"use client";

import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { fetchMyLogsForMovie } from "@/lib/still-api-fetch";

/** True when the signed-in patron has at least one diary log for this film. */
export function useViewerHasWatchedMovie(movieId: number | null | undefined) {
	const { data: session } = authClient.useSession();
	const userId = session?.user?.id;
	const [hasWatched, setHasWatched] = useState(false);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (!movieId || !userId) {
			setHasWatched(false);
			setReady(true);
			return;
		}

		let cancelled = false;
		setReady(false);

		void fetchMyLogsForMovie(movieId).then((res) => {
			if (cancelled) return;
			const rows = res.data;
			setHasWatched(Array.isArray(rows) && rows.length > 0);
			setReady(true);
		});

		return () => {
			cancelled = true;
		};
	}, [movieId, userId]);

	return { hasWatched, ready };
}
