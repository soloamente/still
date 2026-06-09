"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { readCastCrewMonochromeOnHoverPref } from "@/lib/profile-preferences";

let cachedPref: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function loadCastCrewMonochromePref(): Promise<boolean> {
	if (cachedPref !== null) return cachedPref;
	if (inflight) return inflight;
	inflight = (async () => {
		try {
			const res = await api.api.profiles.me.get().catch(() => ({ data: null }));
			const row = res.data as
				| { preferences?: Record<string, unknown> }
				| null
				| undefined;
			cachedPref = readCastCrewMonochromeOnHoverPref(row?.preferences ?? null);
			return cachedPref;
		} catch {
			cachedPref = false;
			return false;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

/** Refresh client cache after Settings save (`next` seeds the saved value). */
export function invalidateCastCrewMonochromePrefCache(next?: boolean) {
	cachedPref = next ?? null;
	inflight = null;
}

/**
 * Signed-in patron preference for cast & crew headshots on film/TV detail.
 * Default `false` (full color) when signed out or unset.
 */
export function useCastCrewMonochromeOnHover(): boolean {
	const [enabled, setEnabled] = useState(() => cachedPref ?? false);

	useEffect(() => {
		let cancel = false;
		void loadCastCrewMonochromePref().then((value) => {
			if (!cancel) setEnabled(value);
		});
		return () => {
			cancel = true;
		};
	}, []);

	return enabled;
}
