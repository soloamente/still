"use client";

import { LetterboxdImportPanel } from "@/components/profile/letterboxd-import-panel";

/** Settings → Data Letterboxd importer (chrome lives in the panel settings variant). */
export function MeLetterboxdImport() {
	return <LetterboxdImportPanel variant="settings" />;
}
