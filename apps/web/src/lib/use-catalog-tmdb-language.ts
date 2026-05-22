"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { resolveCatalogTmdbLanguage } from "@/lib/profile-preferences";

let cachedLanguage: string | null = null;

/** Drop cached profile language after Settings save so search refetches genres. */
export function invalidateCatalogTmdbLanguageCache() {
	cachedLanguage = null;
}

/**
 * Resolved TMDb `language` for the signed-in patron (explicit pref → watch region → en-US).
 */
export function useCatalogTmdbLanguage(enabled: boolean) {
	const [language, setLanguage] = useState(() => cachedLanguage ?? "en-US");

	useEffect(() => {
		if (!enabled) return;

		if (cachedLanguage) {
			setLanguage(cachedLanguage);
			return;
		}

		const ctrl = new AbortController();

		void (async () => {
			try {
				const res = await api.api.profiles.me.get({
					fetch: { signal: ctrl.signal },
				});
				if (ctrl.signal.aborted) return;
				const prefs = (
					res.data as { preferences?: Record<string, unknown> | null } | null
				)?.preferences;
				const next = resolveCatalogTmdbLanguage(prefs ?? null);
				cachedLanguage = next;
				setLanguage(next);
			} catch {
				if (!ctrl.signal.aborted) setLanguage("en-US");
			}
		})();

		return () => ctrl.abort();
	}, [enabled]);

	return language;
}
