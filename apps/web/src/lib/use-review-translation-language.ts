"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { readReviewTranslationLanguagePref } from "@/lib/profile-preferences";
import {
	DEFAULT_REVIEW_TRANSLATION_LANGUAGE,
	normalizeReviewTranslationLanguage,
	resolveReviewTranslationLanguage,
} from "@/lib/review-translation-language";

let cachedPreference: string | null = null;
/** Distinguishes "fetched, patron has no preference" from "not fetched yet". */
let preferenceLoaded = false;

/** Drop the cached preference after a Settings save so open readers pick it up. */
export function invalidateReviewTranslationLanguageCache() {
	cachedPreference = null;
	preferenceLoaded = false;
}

function browserLanguage(): string | null {
	if (typeof navigator === "undefined") return null;
	return normalizeReviewTranslationLanguage(navigator.language);
}

/**
 * Language to translate reviews into: Settings preference → browser language →
 * English. Starts from the browser value so the reader can label its translate
 * control immediately, then upgrades once the profile preference arrives.
 */
export function useReviewTranslationLanguage(enabled: boolean) {
	const [language, setLanguage] = useState(DEFAULT_REVIEW_TRANSLATION_LANGUAGE);

	useEffect(() => {
		if (!enabled) return;

		const navigatorLanguage = browserLanguage();
		setLanguage(
			resolveReviewTranslationLanguage({
				preference: cachedPreference,
				navigatorLanguage,
			}),
		);
		if (preferenceLoaded) return;

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
				cachedPreference = readReviewTranslationLanguagePref(prefs ?? null);
				preferenceLoaded = true;
				setLanguage(
					resolveReviewTranslationLanguage({
						preference: cachedPreference,
						navigatorLanguage,
					}),
				);
			} catch {
				// Browser language already applied above; nothing better to fall back to.
			}
		})();

		return () => ctrl.abort();
	}, [enabled]);

	return language;
}
